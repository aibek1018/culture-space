const baseUrl =
  process.env.DATABASE_URL ??
  'postgresql://culturespace:culturespace@127.0.0.1:5432/culturespace';
const databaseUrl = new URL(baseUrl);
databaseUrl.pathname = '/culturespace_test';

process.env.NODE_ENV ??= 'test';
process.env.API_PORT ??= '4000';
process.env.DATABASE_URL = databaseUrl.toString();
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.SESSION_SECRET ??= 'integration-session-secret-value-32ch';
process.env.APP_ORIGIN ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'info';
process.env.SESSION_KEY_PREFIX ??= 'cs:test:sess:';
process.env.USER_SESSIONS_PREFIX ??= 'test:user-sessions:';
process.env.RATE_LIMIT_PREFIX ??= 'test:rl:';
process.env.OUTBOX_QUEUE_NAME ??= 'cs-outbox-test';
process.env.OUTBOX_POLL_INTERVAL_MS ??= '60000';
process.env.OUTBOX_BACKOFF_MS ??= '30';
