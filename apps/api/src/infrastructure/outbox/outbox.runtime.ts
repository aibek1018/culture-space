import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import { Inject } from '@nestjs/common';
import {
  DelayedError,
  Queue,
  Worker,
  type ConnectionOptions,
  type JobsOptions,
  type Job,
} from 'bullmq';
import { createClient, type RedisClientType } from 'redis';
import type { EntityManager } from 'typeorm';
import { AppConfigService } from '../../config/app-config.service';
import { DomainError } from '../../common/errors/domain-error';
import { PostgresConnection } from '../../database/postgres.connection';
import { MAIL_PORT, type MailPort } from '../mail/mail.port';
import { SessionService } from '../session/session.service';
import { OutboxMessageEntity } from './outbox-message.entity';
import {
  readInvalidateSessionsPayload,
  readSendEmailPayload,
} from './outbox-payload';
import { publicError } from './public-error';
import { decideReconciliation, observeBullState } from './reconciliation';

const ATTEMPTS = 5;
const BATCH_SIZE = 25;

export interface OutboxFailureView {
  id: string;
  messageType: OutboxMessageEntity['messageType'];
  dedupeKey: string;
  processingFailedAt: Date;
  processingError: string | null;
}

@Injectable()
export class OutboxRuntime implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(OutboxRuntime.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redisClient: RedisClientType | null = null;
  private timer: NodeJS.Timeout | null = null;
  private missingTableLogged = false;

  constructor(
    private readonly postgres: PostgresConnection,
    private readonly config: AppConfigService,
    private readonly sessions: SessionService,
    @Inject(MAIL_PORT) private readonly mail: MailPort,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.queue) {
      return;
    }
    const client = createClient({
      url: this.config.redisUrl,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            return new Error('Redis unavailable');
          }
          return Math.min(retries * 200, 1000);
        },
      },
    });
    client.on('error', () => {
      this.logger.error('Outbox Redis connection error');
    });
    try {
      await client.connect();
    } catch {
      this.logger.error('Outbox queue is waiting for Redis');
      await client.disconnect().catch(() => undefined);
      this.timer = setTimeout(() => {
        void this.onApplicationBootstrap();
      }, 5000);
      return;
    }

    // BullMQ's URL connection loads ioredis and blocks the event loop when the
    // socket fails. A connected node-redis client uses the supported adapter.
    const connection = client as unknown as ConnectionOptions;
    this.redisClient = client;
    this.queue = new Queue(this.config.outboxQueueName, { connection });
    this.queue.on('error', () => {
      this.logger.error('Outbox queue connection error');
    });
    this.worker = new Worker(
      this.config.outboxQueueName,
      async (job: Job, token?: string) => {
        if (job.id === undefined) {
          throw new Error('Outbox job is missing an id');
        }
        if (token === undefined) {
          throw new Error('Outbox job is missing a lock token');
        }
        await this.handleDelivery(job.id, { job, token });
      },
      { connection, concurrency: 4 },
    );
    this.worker.on('error', () => {
      this.logger.error('Outbox worker connection error');
    });
    this.worker.on('failed', (job, error) => {
      if (job?.id === undefined) {
        return;
      }
      const maxAttempts = job.opts.attempts ?? ATTEMPTS;
      if (job.attemptsMade < maxAttempts) {
        return;
      }
      void this.markPermanentlyFailed(job.id, error).catch(() => {
        this.logger.error('Could not record a permanent outbox failure');
      });
    });

    try {
      await this.reconcileOnce();
    } catch (error) {
      this.logDependency(error);
    }

    if (this.config.outboxPollIntervalMs > 0) {
      this.timer = setInterval(() => {
        void this.pollOnce().catch((error: unknown) => {
          this.logDependency(error);
        });
      }, this.config.outboxPollIntervalMs);
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    await this.closeQuietly(this.worker?.close());
    await this.closeQuietly(this.queue?.close());
    if (this.redisClient?.isOpen) {
      await this.closeQuietly(this.redisClient.disconnect());
    }
    this.redisClient = null;
  }

  async pause(): Promise<void> {
    await this.worker?.pause();
  }

  async resume(): Promise<void> {
    await this.worker?.resume();
  }

  async pollOnce(): Promise<void> {
    const dataSource = await this.dataSource();
    await dataSource.transaction(async (manager) => {
      const rows: unknown = await manager.query(
        `SELECT id, message_type, payload
         FROM outbox_messages
         WHERE published_at IS NULL
           AND processing_failed_at IS NULL
           AND available_at <= now()
         ORDER BY available_at, id
         LIMIT $1
         FOR UPDATE SKIP LOCKED`,
        [BATCH_SIZE],
      );
      if (!Array.isArray(rows)) {
        return;
      }
      for (const candidate of rows) {
        if (!isClaimRow(candidate)) {
          continue;
        }
        try {
          await this.enqueue(
            candidate.id,
            candidate.message_type,
            candidate.payload,
          );
          await manager.query(
            `UPDATE outbox_messages SET published_at = now() WHERE id = $1`,
            [candidate.id],
          );
        } catch (error) {
          await manager.query(
            `UPDATE outbox_messages
             SET attempts = attempts + 1, last_error = $2
             WHERE id = $1`,
            [candidate.id, publicError(error)],
          );
        }
      }
    });
  }

  async reconcileOnce(): Promise<void> {
    const queue = this.requireQueue();
    const dataSource = await this.dataSource();
    const candidates: unknown = await dataSource.query(
      `SELECT id
       FROM outbox_messages
       WHERE published_at IS NOT NULL
         AND processed_at IS NULL
         AND processing_failed_at IS NULL
       ORDER BY published_at, id`,
    );
    if (!Array.isArray(candidates)) {
      return;
    }
    for (const candidate of candidates) {
      if (!isIdRow(candidate)) {
        continue;
      }
      await dataSource.transaction(async (manager) => {
        const locked: unknown = await manager.query(
          `SELECT id
           FROM outbox_messages
           WHERE id = $1
             AND published_at IS NOT NULL
             AND processed_at IS NULL
             AND processing_failed_at IS NULL
           FOR UPDATE SKIP LOCKED`,
          [candidate.id],
        );
        if (!Array.isArray(locked) || locked.length === 0) {
          return;
        }
        const decision = await this.decisionFor(queue, candidate.id);
        const confirmed = await this.decisionFor(queue, candidate.id);
        if (
          confirmed.action !== 'mark_failed' ||
          decision.action !== 'mark_failed'
        ) {
          return;
        }
        await manager.query(
          `UPDATE outbox_messages
           SET processing_failed_at = now(), processing_error = $2
           WHERE id = $1
             AND processed_at IS NULL
             AND processing_failed_at IS NULL`,
          [candidate.id, confirmed.processingError],
        );
      });
    }
  }

  async listFailed(): Promise<OutboxFailureView[]> {
    const dataSource = await this.dataSource();
    const rows: unknown = await dataSource.query(
      `SELECT id, message_type, dedupe_key, processing_failed_at, processing_error
       FROM outbox_messages
       WHERE processing_failed_at IS NOT NULL
       ORDER BY processing_failed_at, id`,
    );
    if (!Array.isArray(rows)) {
      return [];
    }
    const result: OutboxFailureView[] = [];
    for (const row of rows) {
      const view = toFailureView(row);
      if (view) {
        result.push(view);
      }
    }
    return result;
  }

  async retryFailed(id: string): Promise<void> {
    const queue = this.requireQueue();
    const dataSource = await this.dataSource();
    const row = await dataSource.transaction(async (manager) => {
      const rows: unknown = await manager.query(
        `SELECT id, message_type, payload, published_at, processed_at, processing_failed_at
         FROM outbox_messages
         WHERE id = $1
         FOR UPDATE`,
        [id],
      );
      const locked = Array.isArray(rows) ? rows[0] : undefined;
      if (!isRetryRow(locked)) {
        throw new DomainError(
          'CONFLICT',
          'outbox.not_failed',
          'This outbox message is not permanently failed',
        );
      }
      return locked;
    });
    // Redis must accept the same job before the failure mark disappears.
    // Pausing this process's worker would not stop another API instance.
    // A worker that observes the old mark delays the job instead of failing it.
    const accepted = await this.requeue(queue, row);
    if (!accepted) {
      throw new DomainError(
        'EXTERNAL_UNAVAILABLE',
        'outbox.retry_failed',
        'Could not requeue the outbox message',
      );
    }
    await dataSource.query(
      `UPDATE outbox_messages
       SET processing_failed_at = NULL, processing_error = NULL
       WHERE id = $1
         AND processed_at IS NULL
         AND processing_failed_at IS NOT NULL`,
      [id],
    );
  }

  /**
   * Performs the side effect and then records `processed_at`.
   * A second call after `processed_at` is a no-op.
   */
  async handleDelivery(
    id: string,
    active?: { job: Job; token: string },
  ): Promise<void> {
    const row = await this.loadDelivery(id);
    if (!row) {
      return;
    }
    if (row.processedAt !== null) {
      return;
    }
    if (row.processingFailedAt !== null) {
      if (active) {
        await active.job.moveToDelayed(
          Date.now() + Math.max(this.config.outboxBackoffMs, 50),
          active.token,
        );
        throw new DelayedError();
      }
      throw new Error('Outbox message is marked failed');
    }
    await this.performSideEffect(row.messageType, row.payload);
    await this.markProcessed(id);
  }

  /**
   * Side effect only. Tests and the delivery method use this so a crash
   * before `processed_at` can be repeated. SMTP may send again. Session
   * deletion of a missing key is success. This method does not insert a token.
   */
  async performSideEffect(messageType: string, payload: object): Promise<void> {
    if (messageType === 'SEND_EMAIL') {
      const message = readSendEmailPayload(payload);
      await this.mail.send(message);
      return;
    }
    if (messageType === 'INVALIDATE_SESSIONS') {
      const body = readInvalidateSessionsPayload(payload);
      await this.sessions.invalidateAll(body.userId);
      return;
    }
    throw new Error(`Unsupported outbox message type: ${messageType}`);
  }

  async markProcessed(id: string): Promise<void> {
    const dataSource = await this.dataSource();
    const updated: unknown = await dataSource.query(
      `UPDATE outbox_messages
       SET processed_at = now()
       WHERE id = $1
         AND processed_at IS NULL
         AND processing_failed_at IS NULL
       RETURNING id`,
      [id],
    );
    if (Array.isArray(updated) && updated.length > 0) {
      return;
    }
    const current = await this.loadDelivery(id);
    if (current?.processedAt) {
      return;
    }
    throw new Error('Outbox message was not marked processed');
  }

  async insert(
    manager: EntityManager,
    input: {
      id: string;
      messageType: OutboxMessageEntity['messageType'];
      payload: object;
      dedupeKey: string;
      availableAt: Date;
    },
  ): Promise<void> {
    // The database clock decides availability. A host clock that is ahead of
    // PostgreSQL would otherwise leave the row invisible to the poller.
    await manager.query(
      `INSERT INTO outbox_messages (
         id, message_type, payload, dedupe_key, available_at, published_at,
         attempts, last_error, processed_at, processing_failed_at,
         processing_error, created_at
       ) VALUES (
         $1, $2, $3::jsonb, $4, LEAST($5::timestamptz, now()), NULL,
         0, NULL, NULL, NULL, NULL, now()
       )`,
      [
        input.id,
        input.messageType,
        JSON.stringify(input.payload),
        input.dedupeKey,
        input.availableAt,
      ],
    );
  }

  private async markPermanentlyFailed(
    id: string,
    error: unknown,
  ): Promise<void> {
    const dataSource = await this.dataSource();
    await dataSource.query(
      `UPDATE outbox_messages
       SET processing_failed_at = now(), processing_error = $2
       WHERE id = $1
         AND processed_at IS NULL
         AND processing_failed_at IS NULL`,
      [id, publicError(error)],
    );
  }

  private async enqueue(
    id: string,
    messageType: string,
    payload: object,
  ): Promise<void> {
    const queue = this.requireQueue();
    const existing = await queue.getJob(id);
    if (existing) {
      return;
    }
    try {
      await queue.add(messageType, payload, this.jobOptions(id));
    } catch (error) {
      const raced = await queue.getJob(id);
      if (raced) {
        return;
      }
      throw error;
    }
  }

  private async requeue(
    queue: Queue,
    row: { id: string; message_type: string; payload: object },
  ): Promise<boolean> {
    try {
      return await this.handOffExistingJob(queue, row);
    } catch {
      const job = await queue.getJob(row.id).catch(() => undefined);
      if (!job) {
        return false;
      }
      const state = observeBullState(await job.getState());
      return state === 'waiting' || state === 'delayed' || state === 'active';
    }
  }

  /**
   * Retries the failed BullMQ job or enqueues the same id and payload.
   * A job that is already waiting, delayed, or active was accepted earlier.
   * A completed job is not treated as acceptance: the row is still failed,
   * so the same payload is enqueued again. This does not insert an outbox row.
   */
  private async handOffExistingJob(
    queue: Queue,
    row: { id: string; message_type: string; payload: object },
  ): Promise<boolean> {
    const job = await queue.getJob(row.id);
    if (!job) {
      await queue.add(row.message_type, row.payload, this.jobOptions(row.id));
      return true;
    }
    const state = observeBullState(await job.getState());
    if (state === 'failed') {
      await job.retry();
      return true;
    }
    if (state === 'waiting' || state === 'delayed' || state === 'active') {
      return true;
    }
    if (state === 'completed') {
      await job.remove();
      await queue.add(row.message_type, row.payload, this.jobOptions(row.id));
      return true;
    }
    return false;
  }

  private async decisionFor(queue: Queue, id: string) {
    const job = await queue.getJob(id);
    if (!job) {
      return decideReconciliation('missing', null);
    }
    const state = observeBullState(await job.getState());
    return decideReconciliation(state, job.failedReason ?? null);
  }

  private jobOptions(id: string): JobsOptions {
    return {
      jobId: id,
      attempts: ATTEMPTS,
      backoff: { type: 'exponential', delay: this.config.outboxBackoffMs },
      removeOnComplete: false,
      removeOnFail: false,
    };
  }

  private async loadDelivery(id: string): Promise<{
    messageType: string;
    payload: object;
    processedAt: Date | null;
    processingFailedAt: Date | null;
  } | null> {
    const dataSource = await this.dataSource();
    const rows: unknown = await dataSource.query(
      `SELECT message_type, payload, processed_at, processing_failed_at
       FROM outbox_messages
       WHERE id = $1`,
      [id],
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    if (!isDeliveryRow(row)) {
      return null;
    }
    return {
      messageType: row.message_type,
      payload: row.payload,
      processedAt:
        row.processed_at === null ? null : new Date(row.processed_at),
      processingFailedAt:
        row.processing_failed_at === null
          ? null
          : new Date(row.processing_failed_at),
    };
  }

  private requireQueue(): Queue {
    if (!this.queue) {
      throw new Error('Outbox queue is not initialized');
    }
    return this.queue;
  }

  private async dataSource() {
    await this.postgres.ensureInitialized();
    return this.postgres.getDataSource();
  }

  private logDependency(error: unknown): void {
    const message = error instanceof Error ? error.message : '';
    if (
      message.includes('outbox_messages') &&
      message.includes('does not exist')
    ) {
      if (!this.missingTableLogged) {
        this.missingTableLogged = true;
        this.logger.error('Outbox table is not migrated');
      }
      return;
    }
    this.logger.error('Outbox dependency is unavailable');
  }

  private async closeQuietly(
    pending: Promise<unknown> | undefined,
  ): Promise<void> {
    if (pending === undefined) {
      return;
    }
    await Promise.race([
      pending.catch(() => undefined),
      new Promise((resolve) => setTimeout(resolve, 1000)),
    ]);
  }
}

function isClaimRow(
  value: unknown,
): value is { id: string; message_type: string; payload: object } {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const id = Reflect.get(value, 'id');
  const messageType = Reflect.get(value, 'message_type');
  const payload = Reflect.get(value, 'payload');
  return (
    typeof id === 'string' &&
    typeof messageType === 'string' &&
    typeof payload === 'object' &&
    payload !== null
  );
}

function isIdRow(value: unknown): value is { id: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof Reflect.get(value, 'id') === 'string'
  );
}

function isRetryRow(value: unknown): value is {
  id: string;
  message_type: string;
  payload: object;
  published_at: Date | string | null;
  processed_at: Date | string | null;
  processing_failed_at: Date | string | null;
} {
  if (!isClaimRow(value)) {
    return false;
  }
  const published = Reflect.get(value, 'published_at');
  const processed = Reflect.get(value, 'processed_at');
  const failed = Reflect.get(value, 'processing_failed_at');
  return (
    published !== null &&
    published !== undefined &&
    failed !== null &&
    failed !== undefined &&
    (processed === null || processed === undefined)
  );
}

function isDeliveryRow(value: unknown): value is {
  message_type: string;
  payload: object;
  processed_at: string | Date | null;
  processing_failed_at: string | Date | null;
} {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const messageType = Reflect.get(value, 'message_type');
  const payload = Reflect.get(value, 'payload');
  return (
    typeof messageType === 'string' &&
    typeof payload === 'object' &&
    payload !== null
  );
}

function toFailureView(value: unknown): OutboxFailureView | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const id = Reflect.get(value, 'id');
  const messageType = Reflect.get(value, 'message_type');
  const dedupeKey = Reflect.get(value, 'dedupe_key');
  const failedAt = Reflect.get(value, 'processing_failed_at');
  const processingError = Reflect.get(value, 'processing_error');
  if (
    typeof id !== 'string' ||
    !isMessageType(messageType) ||
    typeof dedupeKey !== 'string' ||
    (typeof failedAt !== 'string' && !(failedAt instanceof Date))
  ) {
    return null;
  }
  return {
    id,
    messageType,
    dedupeKey,
    processingFailedAt:
      failedAt instanceof Date ? failedAt : new Date(failedAt),
    processingError:
      typeof processingError === 'string' ? processingError : null,
  };
}

function isMessageType(
  value: unknown,
): value is OutboxMessageEntity['messageType'] {
  return (
    value === 'SEND_EMAIL' ||
    value === 'INVALIDATE_SESSIONS' ||
    value === 'CREATE_NOTIFICATION' ||
    value === 'REFRESH_WORK'
  );
}
