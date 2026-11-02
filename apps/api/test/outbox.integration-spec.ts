import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { Queue, Worker } from 'bullmq';
import { OutboxRuntime } from '../src/infrastructure/outbox/outbox.runtime';
import { PasswordService } from '../src/modules/auth/password.service';
import {
  createTestApp,
  delay,
  errorCode,
  failingWorker,
  graphqlAgent,
  openBullClient,
  openQueue,
  resetState,
  ScriptedMailer,
  settleOutbox,
} from './harness';

async function registerReader(app: INestApplication): Promise<string> {
  const response = await graphqlAgent(app).send(
    `mutation($input: RegisterInput!) { register(input: $input) { id } }`,
    {
      input: {
        username: 'reader_one',
        fullName: 'Reader One',
        email: 'reader@example.com',
        password: 'correct-horse',
        preferredLanguage: 'EN',
      },
    },
  );
  return response.body.data.register.id as string;
}

async function promoteAdmin(
  app: INestApplication,
  userId: string,
): Promise<void> {
  await app
    .get(DataSource)
    .query(
      `UPDATE users SET role = 'ADMIN', email_verified_at = now() WHERE id = $1`,
      [userId],
    );
}

describe('transactional outbox and BullMQ', () => {
  let app: INestApplication;
  const mailer = new ScriptedMailer();

  beforeAll(async () => {
    app = await createTestApp(mailer);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.get(OutboxRuntime).pause();
    await resetState(app);
    mailer.reset();
    await app.get(OutboxRuntime).resume();
  });

  it('records one permanent failure and lets an administrator retry it', async () => {
    mailer.mode = 'fail';
    const userId = await registerReader(app);
    await settleOutbox(app);
    const dataSource = app.get(DataSource);
    const failed = await dataSource.query(
      `SELECT id, dedupe_key, processing_failed_at FROM outbox_messages`,
    );
    expect(failed).toHaveLength(1);
    expect(failed[0].processing_failed_at).not.toBeNull();
    const dedupeKey = failed[0].dedupe_key as string;
    expect(
      Number(
        (
          await dataSource.query(
            'SELECT count(*)::int AS count FROM email_verification_tokens',
          )
        )[0].count,
      ),
    ).toBe(1);

    await promoteAdmin(app, userId);
    mailer.mode = 'ok';
    const agent = graphqlAgent(app);
    await agent.send(
      `mutation($input: LoginInput!) { login(input: $input) { id } }`,
      { input: { email: 'reader@example.com', password: 'correct-horse' } },
    );
    const retried = await agent.send(
      `mutation($id: UUID!) { retryFailedOutboxMessage(id: $id) }`,
      { id: failed[0].id },
    );
    expect(retried.body.data.retryFailedOutboxMessage).toBe(true);
    await settleOutbox(app);
    const after = await dataSource.query(
      `SELECT dedupe_key, processed_at, processing_failed_at FROM outbox_messages`,
    );
    expect(after).toHaveLength(1);
    expect(after[0].dedupe_key).toBe(dedupeKey);
    expect(after[0].processed_at).not.toBeNull();
    expect(after[0].processing_failed_at).toBeNull();
    expect(mailer.sent).toHaveLength(1);
    const payload = await dataSource.query(
      `SELECT payload FROM outbox_messages`,
    );
    expect(payload).toHaveLength(1);
  });

  it('keeps the failure visible when the job is requeued before the mark is cleared', async () => {
    mailer.mode = 'fail';
    const userId = await registerReader(app);
    await settleOutbox(app);
    mailer.mode = 'ok';
    mailer.reset();
    const dataSource = app.get(DataSource);
    const before = (
      await dataSource.query(
        `SELECT id, dedupe_key, payload, processing_failed_at
         FROM outbox_messages`,
      )
    )[0];
    expect(before.processing_failed_at).not.toBeNull();
    const queue = await openQueue();
    try {
      const job = await queue.getJob(before.id as string);
      expect(job).toBeDefined();
      expect(await job?.getState()).toBe('failed');
      await job?.retry();
    } finally {
      await queue.close();
    }
    await delay(250);
    const during = (
      await dataSource.query(
        `SELECT dedupe_key, payload, processed_at, processing_failed_at
         FROM outbox_messages`,
      )
    )[0];
    expect(during.processing_failed_at).not.toBeNull();
    expect(during.processed_at).toBeNull();
    expect(during.dedupe_key).toBe(before.dedupe_key);
    expect(during.payload).toEqual(before.payload);
    expect(mailer.sent).toHaveLength(0);
    expect(
      Number(
        (
          await dataSource.query(
            `SELECT count(*)::int AS count FROM outbox_messages`,
          )
        )[0].count,
      ),
    ).toBe(1);

    await promoteAdmin(app, userId);
    const agent = graphqlAgent(app);
    await agent.send(
      `mutation($input: LoginInput!) { login(input: $input) { id } }`,
      { input: { email: 'reader@example.com', password: 'correct-horse' } },
    );
    const retried = await agent.send(
      `mutation($id: UUID!) { retryFailedOutboxMessage(id: $id) }`,
      { id: before.id },
    );
    expect(retried.body.data.retryFailedOutboxMessage).toBe(true);
    await settleOutbox(app);
    const after = (
      await dataSource.query(
        `SELECT dedupe_key, payload, processed_at, processing_failed_at
         FROM outbox_messages`,
      )
    )[0];
    expect(after.dedupe_key).toBe(before.dedupe_key);
    expect(after.payload).toEqual(before.payload);
    expect(after.processed_at).not.toBeNull();
    expect(after.processing_failed_at).toBeNull();
    expect(mailer.sent).toHaveLength(1);
    expect(
      Number(
        (
          await dataSource.query(
            `SELECT count(*)::int AS count FROM email_verification_tokens`,
          )
        )[0].count,
      ),
    ).toBe(1);
  });

  it('sends the same token email twice without inserting another token', async () => {
    await app.get(OutboxRuntime).pause();
    await registerReader(app);
    const dataSource = app.get(DataSource);
    const row = (
      await dataSource.query(
        `SELECT message_type, payload FROM outbox_messages`,
      )
    )[0];
    const runtime = app.get(OutboxRuntime);
    await runtime.performSideEffect(row.message_type, row.payload);
    await runtime.performSideEffect(row.message_type, row.payload);
    expect(mailer.sent).toHaveLength(2);
    expect(mailer.sent[0]?.text).toBe(mailer.sent[1]?.text);
    expect(
      Number(
        (
          await dataSource.query(
            'SELECT count(*)::int AS count FROM email_verification_tokens',
          )
        )[0].count,
      ),
    ).toBe(1);
  });

  it('deletes sessions again after a crash past the first deletion', async () => {
    const userId = await registerReader(app);
    await settleOutbox(app);
    const passwords = app.get(PasswordService);
    const dataSource = app.get(DataSource);
    await dataSource.query(
      `UPDATE users SET password_hash = $2 WHERE id = $1`,
      [userId, await passwords.hash('correct-horse')],
    );
    const first = graphqlAgent(app);
    const second = graphqlAgent(app);
    const login = `mutation($input: LoginInput!) { login(input: $input) { id } }`;
    const credentials = {
      input: { email: 'reader@example.com', password: 'correct-horse' },
    };
    await first.send(login, credentials);
    await second.send(login, credentials);
    const runtime = app.get(OutboxRuntime);
    await runtime.performSideEffect('INVALIDATE_SESSIONS', { userId });
    expect((await first.send(`query { me { id } }`)).body.data.me).toBeNull();
    await runtime.performSideEffect('INVALIDATE_SESSIONS', { userId });
    expect((await second.send(`query { me { id } }`)).body.data.me).toBeNull();
  });

  it('marks a failed job whose listener did not run and a job missing from Redis', async () => {
    await app.get(OutboxRuntime).pause();
    await registerReader(app);
    const runtime = app.get(OutboxRuntime);
    await runtime.pollOnce();
    const dataSource = app.get(DataSource);
    const published = (
      await dataSource.query(
        `SELECT id FROM outbox_messages WHERE published_at IS NOT NULL`,
      )
    )[0];
    const queue = await openQueue();
    const worker = await failingWorker();
    try {
      const started = Date.now();
      let state = '';
      while (Date.now() - started < 15000) {
        const job = await queue.getJob(published.id);
        state = job ? await job.getState() : 'missing';
        if (state === 'failed') {
          break;
        }
        await delay(50);
      }
      expect(state).toBe('failed');
      await runtime.reconcileOnce();
      const missed = (
        await dataSource.query(
          `SELECT processing_error FROM outbox_messages WHERE id = $1`,
          [published.id],
        )
      )[0];
      expect(missed.processing_error).toContain('listener missed');
    } finally {
      await worker.close();
      await queue.close();
    }

    await resetState(app);
    mailer.reset();
    await registerReader(app);
    await runtime.pollOnce();
    const lost = (
      await dataSource.query(
        `SELECT id FROM outbox_messages WHERE published_at IS NOT NULL`,
      )
    )[0];
    const lossQueue = await openQueue();
    try {
      const job = await lossQueue.getJob(lost.id);
      await job?.remove();
      await runtime.reconcileOnce();
    } finally {
      await lossQueue.close();
    }
    const missing = (
      await dataSource.query(
        `SELECT processing_error FROM outbox_messages WHERE id = $1`,
        [lost.id],
      )
    )[0];
    expect(missing.processing_error).toBe('job_missing');
  });

  it('leaves waiting, delayed, active, and completed jobs unmarked', async () => {
    const runtime = app.get(OutboxRuntime);
    await runtime.pause();
    await registerReader(app);
    await runtime.pollOnce();
    const dataSource = app.get(DataSource);
    const row = (await dataSource.query(`SELECT id FROM outbox_messages`))[0];
    const queue = await openQueue();
    try {
      await runtime.reconcileOnce();
      let current = (
        await dataSource.query(
          `SELECT processing_failed_at FROM outbox_messages WHERE id = $1`,
          [row.id],
        )
      )[0];
      expect(current.processing_failed_at).toBeNull();
      const waitingJob = await queue.getJob(row.id);
      await waitingJob?.remove();
      await queue.add(
        'SEND_EMAIL',
        { ok: true },
        { jobId: row.id, delay: 60_000 },
      );
      await runtime.reconcileOnce();
      current = (
        await dataSource.query(
          `SELECT processing_failed_at FROM outbox_messages WHERE id = $1`,
          [row.id],
        )
      )[0];
      expect(current.processing_failed_at).toBeNull();
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
    }
    await assertHeldStates(app);
  });

  it('does not add a row or overwrite processed_at when two scans overlap', async () => {
    const dataSource = app.get(DataSource);
    const id = '33333333-3333-4333-8333-333333333333';
    await dataSource.query(
      `INSERT INTO outbox_messages (
         id, message_type, payload, dedupe_key, available_at, published_at, processed_at, created_at
       ) VALUES ($1, 'SEND_EMAIL', '{"to":"a@example.com","subject":"s","text":"t"}'::jsonb,
         $2, now(), now(), now(), now())`,
      [id, `done:${id}`],
    );
    const before = (
      await dataSource.query(
        `SELECT processed_at FROM outbox_messages WHERE id = $1`,
        [id],
      )
    )[0].processed_at;
    const runtime = app.get(OutboxRuntime);
    await Promise.all([runtime.reconcileOnce(), runtime.reconcileOnce()]);
    const after = (
      await dataSource.query(
        `SELECT processed_at, processing_failed_at FROM outbox_messages WHERE id = $1`,
        [id],
      )
    )[0];
    expect(new Date(after.processed_at).toISOString()).toBe(
      new Date(before).toISOString(),
    );
    expect(after.processing_failed_at).toBeNull();

    await runtime.pause();
    const failedId = '44444444-4444-4444-8444-444444444444';
    await dataSource.query(
      `INSERT INTO outbox_messages (
         id, message_type, payload, dedupe_key, available_at, published_at, created_at
       ) VALUES ($1, 'INVALIDATE_SESSIONS', $2::jsonb, $3, now(), now(), now())`,
      [
        failedId,
        JSON.stringify({ userId: '55555555-5555-4555-8555-555555555555' }),
        `failed:${failedId}`,
      ],
    );
    const queue = await openQueue();
    const worker = await failingWorker();
    try {
      await queue.add(
        'INVALIDATE_SESSIONS',
        { userId: '55555555-5555-4555-8555-555555555555' },
        {
          jobId: failedId,
          attempts: 5,
          backoff: { type: 'exponential', delay: 20 },
        },
      );
      await waitForState(queue, failedId, 'failed');
      await Promise.all([runtime.reconcileOnce(), runtime.reconcileOnce()]);
    } finally {
      await worker.close();
      await queue.close();
    }
    const rows = await dataSource.query(
      `SELECT processing_failed_at, dedupe_key FROM outbox_messages WHERE id = $1`,
      [failedId],
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].processing_failed_at).not.toBeNull();
    expect(rows[0].dedupe_key).toBe(`failed:${failedId}`);
    const denied = await graphqlAgent(app).send(
      `mutation($id: UUID!) { retryFailedOutboxMessage(id: $id) }`,
      { id: failedId },
    );
    expect(errorCode(denied.body)).toBe('UNAUTHENTICATED');
  });

  it('rejects retry of a message that is not permanently failed', async () => {
    const userId = await registerReader(app);
    await promoteAdmin(app, userId);
    await settleOutbox(app);
    const agent = graphqlAgent(app);
    await agent.send(
      `mutation($input: LoginInput!) { login(input: $input) { id } }`,
      {
        input: { email: 'reader@example.com', password: 'correct-horse' },
      },
    );
    const id = (
      await app.get(DataSource).query(`SELECT id FROM outbox_messages`)
    )[0].id;
    const response = await agent.send(
      `mutation($id: UUID!) { retryFailedOutboxMessage(id: $id) }`,
      { id },
    );
    expect(errorCode(response.body)).toBe('CONFLICT');
  });
});

async function assertHeldStates(app: INestApplication): Promise<void> {
  const dataSource = app.get(DataSource);
  const runtime = app.get(OutboxRuntime);
  await dataSource.query(`DELETE FROM outbox_messages`);
  const activeId = '11111111-1111-4111-8111-111111111111';
  await insertPublished(dataSource, activeId, `active:${activeId}`);
  let release: () => void = () => undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const activeQueue = new Queue(process.env.OUTBOX_QUEUE_NAME ?? 'cs-outbox', {
    connection: await openBullClient(),
  });
  const activeWorker = new Worker(
    process.env.OUTBOX_QUEUE_NAME ?? 'cs-outbox',
    async () => {
      await gate;
    },
    { connection: await openBullClient(), concurrency: 1 },
  );
  try {
    await activeQueue.add(
      'SEND_EMAIL',
      { ok: true },
      { jobId: activeId, attempts: 5 },
    );
    await waitForState(activeQueue, activeId, 'active');
    await runtime.reconcileOnce();
    const activeRow = (
      await dataSource.query(
        `SELECT processing_failed_at, processed_at FROM outbox_messages WHERE id = $1`,
        [activeId],
      )
    )[0];
    expect(activeRow.processing_failed_at).toBeNull();
    expect(activeRow.processed_at).toBeNull();
  } finally {
    release();
    await activeWorker.close();
    await activeQueue.obliterate({ force: true });
    await activeQueue.close();
  }

  const completedId = '22222222-2222-4222-8222-222222222222';
  await insertPublished(dataSource, completedId, `completed:${completedId}`);
  const completedQueue = new Queue(
    process.env.OUTBOX_QUEUE_NAME ?? 'cs-outbox',
    {
      connection: await openBullClient(),
    },
  );
  const completedWorker = new Worker(
    process.env.OUTBOX_QUEUE_NAME ?? 'cs-outbox',
    async () => undefined,
    { connection: await openBullClient(), concurrency: 1 },
  );
  try {
    await completedQueue.add(
      'SEND_EMAIL',
      { ok: true },
      { jobId: completedId },
    );
    await waitForState(completedQueue, completedId, 'completed');
    await runtime.reconcileOnce();
    const completedRow = (
      await dataSource.query(
        `SELECT processing_failed_at, processed_at FROM outbox_messages WHERE id = $1`,
        [completedId],
      )
    )[0];
    expect(completedRow.processing_failed_at).toBeNull();
    expect(completedRow.processed_at).toBeNull();
  } finally {
    await completedWorker.close();
    await completedQueue.close();
  }
}

async function insertPublished(
  dataSource: DataSource,
  id: string,
  dedupeKey: string,
): Promise<void> {
  await dataSource.query(
    `INSERT INTO outbox_messages (
       id, message_type, payload, dedupe_key, available_at, published_at, created_at
     ) VALUES ($1, 'SEND_EMAIL', $2::jsonb, $3, now(), now(), now())`,
    [
      id,
      JSON.stringify({ to: 'a@example.com', subject: 's', text: 't' }),
      dedupeKey,
    ],
  );
}

async function waitForState(
  queue: Queue,
  id: string,
  expected: string,
): Promise<void> {
  const started = Date.now();
  let state = '';
  while (Date.now() - started < 8000) {
    const job = await queue.getJob(id);
    state = job ? await job.getState() : '';
    if (state === expected) {
      return;
    }
    await delay(30);
  }
  throw new Error(`Job ${id} stayed ${state}`);
}
