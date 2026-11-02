import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { Queue, Worker, type ConnectionOptions, type Job } from 'bullmq';
import { createClient, type RedisClientType } from 'redis';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';
import {
  MAIL_PORT,
  type MailPort,
  type OutboundMail,
} from '../src/infrastructure/mail/mail.port';
import { NodemailerMailer } from '../src/infrastructure/mail/nodemailer-mailer';
import { OutboxRuntime } from '../src/infrastructure/outbox/outbox.runtime';
import { PostgresConnection } from '../src/database/postgres.connection';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import {
  SESSION_COOKIE_NAME,
  SESSION_KEY_PREFIX,
  USER_SESSIONS_PREFIX,
} from '../src/infrastructure/session/session.constants';

export class ScriptedMailer implements MailPort {
  mode: 'ok' | 'fail' = 'ok';
  sent: OutboundMail[] = [];

  async send(message: OutboundMail): Promise<void> {
    if (this.mode === 'fail') {
      throw new Error('smtp rejected the message');
    }
    this.sent.push({ ...message });
  }

  reset(): void {
    this.mode = 'ok';
    this.sent = [];
  }
}

export async function createTestApp(
  mailer: ScriptedMailer,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(NodemailerMailer)
    .useValue(mailer)
    .overrideProvider(MAIL_PORT)
    .useValue(mailer)
    .compile();
  const app = moduleRef.createNestApplication({ logger: false });
  configureApp(app);
  const postgres = app.get(PostgresConnection);
  await postgres.ensureInitialized();
  await postgres.getDataSource().runMigrations();
  await app.init();
  const bound = app.get<MailPort>(MAIL_PORT);
  if (bound !== mailer) {
    const name = bound.constructor?.name ?? 'unknown';
    throw new Error(`Mail port was not replaced (${name})`);
  }
  return app;
}

export async function resetState(app: INestApplication): Promise<void> {
  await disconnectBullClients();
  const dataSource = app.get(DataSource);
  await dataSource.query('DROP TABLE IF EXISTS notifications');
  await dataSource.query(`
    TRUNCATE TABLE
      outbox_messages,
      follows,
      user_restrictions,
      password_reset_tokens,
      email_verification_tokens,
      user_preferences,
      users
    RESTART IDENTITY CASCADE
  `);
  const redis = app.get(RedisService);
  if (!redis.client.isOpen) {
    await redis.client.connect();
  }
  const ratePrefix = process.env.RATE_LIMIT_PREFIX ?? 'rl:';
  const queueName = process.env.OUTBOX_QUEUE_NAME ?? 'cs-outbox';
  for (const pattern of [
    `${SESSION_KEY_PREFIX}*`,
    `${USER_SESSIONS_PREFIX}*`,
    `${ratePrefix}*`,
    `bull:${queueName}*`,
  ]) {
    const keys = await redis.client.keys(pattern);
    if (keys.length > 0) {
      await redis.client.del(keys);
    }
  }
}

export function graphqlAgent(app: INestApplication) {
  const agent = request.agent(app.getHttpServer());
  const send = (query: string, variables?: Record<string, unknown>) =>
    agent
      .post('/graphql')
      .set('Origin', 'http://localhost:3000')
      .set('x-culturespace-client', 'web')
      .send({ query, variables });
  return { agent, send };
}

export function errorCode(body: {
  errors?: Array<{ extensions?: { code?: string } }>;
}): string | undefined {
  return body.errors?.[0]?.extensions?.code;
}

export function sessionIdFromResponse(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const cookies = Array.isArray(header) ? header : header ? [header] : [];
  const raw = cookies.find((cookie) =>
    cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
  );
  if (raw === undefined) {
    throw new Error('Session cookie was not set');
  }
  const pair = raw.split(';')[0] ?? '';
  const value = decodeURIComponent(pair.slice(SESSION_COOKIE_NAME.length + 1));
  const unsigned = value.startsWith('s:') ? value.slice(2) : value;
  const dot = unsigned.lastIndexOf('.');
  return dot === -1 ? unsigned : unsigned.slice(0, dot);
}

export function tokenFromMessage(text: string): string {
  const match = /token=([^&\s]+)/.exec(text);
  const token = match?.[1];
  if (token === undefined) {
    throw new Error('Email did not contain a token');
  }
  return decodeURIComponent(token);
}

export async function settleOutbox(app: INestApplication): Promise<void> {
  const runtime = app.get(OutboxRuntime);
  await runtime.pollOnce();
  const dataSource = app.get(DataSource);
  const started = Date.now();
  while (Date.now() - started < 15000) {
    const rows: Array<{ count: string | number }> = await dataSource.query(
      `SELECT count(*)::int AS count
       FROM outbox_messages
       WHERE published_at IS NOT NULL
         AND processed_at IS NULL
         AND processing_failed_at IS NULL`,
    );
    const count = Number(rows[0]?.count ?? 0);
    if (count === 0) {
      return;
    }
    await delay(40);
  }
  throw new Error('Outbox work did not settle');
}

const bullClients: RedisClientType[] = [];

/** Connected node-redis client. BullMQ's URL form blocks the event loop. */
export async function openBullClient(): Promise<ConnectionOptions> {
  const client = createClient({
    url: process.env.REDIS_URL ?? 'redis://127.0.0.1:6379',
    socket: { connectTimeout: 2000 },
  });
  client.on('error', () => undefined);
  await client.connect();
  bullClients.push(client);
  return client as unknown as ConnectionOptions;
}

export async function disconnectBullClients(): Promise<void> {
  const pending = bullClients.splice(0);
  await Promise.all(
    pending.map(async (client) => {
      if (client.isOpen) {
        await client.disconnect().catch(() => undefined);
      }
    }),
  );
}

export async function openQueue(): Promise<Queue> {
  return new Queue(process.env.OUTBOX_QUEUE_NAME ?? 'cs-outbox', {
    connection: await openBullClient(),
  });
}

export async function failingWorker(): Promise<Worker> {
  return new Worker(
    process.env.OUTBOX_QUEUE_NAME ?? 'cs-outbox',
    async (_job: Job) => {
      throw new Error('listener missed this failure');
    },
    { connection: await openBullClient(), concurrency: 1 },
  );
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
