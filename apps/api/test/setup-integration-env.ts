process.env.NODE_ENV ??= 'test';
process.env.API_PORT ??= '4000';
process.env.DATABASE_URL ??=
  'postgresql://culturespace:culturespace@127.0.0.1:5432/culturespace';
process.env.REDIS_URL ??= 'redis://127.0.0.1:6379';
process.env.SESSION_SECRET ??= 'integration-session-secret-value-32ch';
process.env.APP_ORIGIN ??= 'http://localhost:3000';
process.env.LOG_LEVEL ??= 'info';
