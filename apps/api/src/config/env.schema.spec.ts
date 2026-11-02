import {
  LOCAL_DEVELOPMENT_MINIO_SECRET,
  LOCAL_DEVELOPMENT_SESSION_SECRET,
  validateEnv,
} from './env.schema';

const validEnv = {
  NODE_ENV: 'test',
  API_PORT: '4000',
  DATABASE_URL:
    'postgresql://culturespace:culturespace@127.0.0.1:5432/culturespace',
  REDIS_URL: 'redis://127.0.0.1:6379',
  SESSION_SECRET: 'test-session-secret-with-enough-length',
  APP_ORIGIN: 'http://localhost:3000',
  LOG_LEVEL: 'info',
};

describe('validateEnv', () => {
  it('rejects a payload that omits required variables', () => {
    expect(() => validateEnv({})).toThrow(/API_PORT/);
    expect(() => validateEnv({})).toThrow(/DATABASE_URL/);
    expect(() => validateEnv({})).toThrow(/REDIS_URL/);
    expect(() => validateEnv({})).toThrow(/SESSION_SECRET/);
    expect(() => validateEnv({})).toThrow(/APP_ORIGIN/);
    expect(() => validateEnv({})).toThrow(/LOG_LEVEL/);
    expect(() => validateEnv({})).toThrow(/NODE_ENV/);
  });

  it('does not echo secret values when validation fails', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        SESSION_SECRET: 'short-but-sensitive-value',
      }),
    ).toThrow(/SESSION_SECRET/);

    try {
      validateEnv({
        ...validEnv,
        SESSION_SECRET: 'short-but-sensitive-value',
      });
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect((error as Error).message).not.toContain(
        'short-but-sensitive-value',
      );
    }
  });

  it.each([
    ['API_PORT', 'not-a-port'],
    ['API_PORT', '0'],
    ['DATABASE_URL', 'mysql://localhost/db'],
    ['REDIS_URL', 'http://127.0.0.1:6379'],
    ['SESSION_SECRET', 'too-short'],
    ['APP_ORIGIN', 'localhost:3000'],
    ['NODE_ENV', 'staging'],
    ['LOG_LEVEL', 'verbose'],
  ])('rejects malformed %s', (key, value) => {
    expect(() => validateEnv({ ...validEnv, [key]: value })).toThrow(
      new RegExp(key),
    );
  });

  it('accepts a complete development configuration', () => {
    const config = validateEnv(validEnv);
    expect(config).toEqual({
      nodeEnv: 'test',
      apiPort: 4000,
      databaseUrl: validEnv.DATABASE_URL,
      redisUrl: validEnv.REDIS_URL,
      sessionSecret: validEnv.SESSION_SECRET,
      appOrigin: validEnv.APP_ORIGIN,
      logLevel: 'info',
      smtpHost: '127.0.0.1',
      smtpPort: 1025,
      smtpFrom: 'noreply@culturespace.local',
      smtpUser: null,
      smtpPassword: null,
      minioEndpoint: 'http://127.0.0.1:9000',
      minioAccessKey: 'culturespace',
      minioSecretKey: LOCAL_DEVELOPMENT_MINIO_SECRET,
      minioBucket: 'avatars',
      minioPublicBaseUrl: 'http://127.0.0.1:9000',
      outboxPollIntervalMs: 1000,
      outboxBackoffMs: 1000,
      outboxQueueName: 'cs-outbox',
    });
  });

  it('rejects the development session secret in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://culturespace.example',
        SESSION_SECRET: LOCAL_DEVELOPMENT_SESSION_SECRET,
      }),
    ).toThrow(/SESSION_SECRET/);
  });

  it('rejects the local object-storage secret and an http media URL in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://culturespace.example',
        SESSION_SECRET: 'production-session-secret-value-32',
        MINIO_SECRET_KEY: LOCAL_DEVELOPMENT_MINIO_SECRET,
        MINIO_PUBLIC_BASE_URL: 'https://media.culturespace.example',
      }),
    ).toThrow(/MINIO_SECRET_KEY/);

    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        APP_ORIGIN: 'https://culturespace.example',
        SESSION_SECRET: 'production-session-secret-value-32',
        MINIO_SECRET_KEY: 'production-object-storage-secret',
        MINIO_PUBLIC_BASE_URL: 'http://media.culturespace.example',
      }),
    ).toThrow(/MINIO_PUBLIC_BASE_URL/);
  });

  it('rejects an http application origin in production', () => {
    expect(() =>
      validateEnv({
        ...validEnv,
        NODE_ENV: 'production',
        APP_ORIGIN: 'http://culturespace.example',
        SESSION_SECRET: 'production-session-secret-value-32',
      }),
    ).toThrow(/APP_ORIGIN/);
  });
});
