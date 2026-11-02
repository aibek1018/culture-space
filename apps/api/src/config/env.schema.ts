import { z } from 'zod';

/** Local Compose and `.env.example` value. Production startup rejects it. */
export const LOCAL_DEVELOPMENT_SESSION_SECRET =
  'dev-only-session-secret-change-me!!';

/** Local MinIO password from Compose. Production startup rejects it. */
export const LOCAL_DEVELOPMENT_MINIO_SECRET = 'culturespace-dev-only';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);
const logLevelSchema = z.enum([
  'fatal',
  'error',
  'warn',
  'info',
  'debug',
  'trace',
]);

const envSchema = z.object({
  NODE_ENV: nodeEnvSchema,
  API_PORT: z.coerce.number().int().min(1).max(65535),
  DATABASE_URL: z
    .string()
    .regex(
      /^postgres(ql)?:\/\/\S+$/,
      'DATABASE_URL must be a PostgreSQL connection URL',
    ),
  REDIS_URL: z
    .string()
    .regex(/^rediss?:\/\/\S+$/, 'REDIS_URL must be a Redis connection URL'),
  SESSION_SECRET: z.string().min(32).max(256),
  APP_ORIGIN: z
    .string()
    .regex(/^https?:\/\/\S+$/, 'APP_ORIGIN must be an absolute http(s) URL'),
  LOG_LEVEL: logLevelSchema,
  SMTP_HOST: z.string().min(1).max(255).default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535).default(1025),
  SMTP_FROM: z.string().min(3).max(320).default('noreply@culturespace.local'),
  SMTP_USER: z.string().max(320).optional(),
  SMTP_PASSWORD: z.string().max(256).optional(),
  MINIO_ENDPOINT: z
    .string()
    .regex(/^https?:\/\/\S+$/, 'MINIO_ENDPOINT must be an absolute http(s) URL')
    .default('http://127.0.0.1:9000'),
  MINIO_ACCESS_KEY: z.string().min(1).max(256).default('culturespace'),
  MINIO_SECRET_KEY: z
    .string()
    .min(8)
    .max(256)
    .default(LOCAL_DEVELOPMENT_MINIO_SECRET),
  MINIO_BUCKET: z
    .string()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .default('avatars'),
  MINIO_PUBLIC_BASE_URL: z
    .string()
    .regex(
      /^https?:\/\/\S+$/,
      'MINIO_PUBLIC_BASE_URL must be an absolute http(s) URL',
    )
    .default('http://127.0.0.1:9000'),
  OUTBOX_POLL_INTERVAL_MS: z.coerce
    .number()
    .int()
    .min(0)
    .max(3_600_000)
    .default(1000),
  OUTBOX_BACKOFF_MS: z.coerce.number().int().min(10).max(300_000).default(1000),
  OUTBOX_QUEUE_NAME: z
    .string()
    .regex(/^[a-z0-9][a-z0-9-]{0,62}$/)
    .default('cs-outbox'),
});

export type NodeEnv = z.infer<typeof nodeEnvSchema>;
export type LogLevel = z.infer<typeof logLevelSchema>;

export interface AppConfig {
  nodeEnv: NodeEnv;
  apiPort: number;
  databaseUrl: string;
  redisUrl: string;
  sessionSecret: string;
  appOrigin: string;
  logLevel: LogLevel;
  smtpHost: string;
  smtpPort: number;
  smtpFrom: string;
  smtpUser: string | null;
  smtpPassword: string | null;
  minioEndpoint: string;
  minioAccessKey: string;
  minioSecretKey: string;
  minioBucket: string;
  minioPublicBaseUrl: string;
  outboxPollIntervalMs: number;
  outboxBackoffMs: number;
  outboxQueueName: string;
}

/**
 * Validates process environment without echoing secret values in the error.
 * The Nest process refuses to boot when this throws.
 */
export function validateEnv(input: Record<string, unknown>): AppConfig {
  const result = envSchema.safeParse(input);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => {
        const path = issue.path.join('.');
        return `${path.length > 0 ? path : 'environment'}: ${issue.message}`;
      })
      .join('; ');
    throw new Error(`Invalid environment: ${details}`);
  }

  const parsed = result.data;
  if (parsed.NODE_ENV === 'production') {
    if (parsed.SESSION_SECRET === LOCAL_DEVELOPMENT_SESSION_SECRET) {
      throw new Error(
        'Invalid environment: SESSION_SECRET: Refusing the local development session secret in production',
      );
    }
    if (!parsed.APP_ORIGIN.startsWith('https://')) {
      throw new Error(
        'Invalid environment: APP_ORIGIN: Production APP_ORIGIN must use https',
      );
    }
    if (parsed.MINIO_SECRET_KEY === LOCAL_DEVELOPMENT_MINIO_SECRET) {
      throw new Error(
        'Invalid environment: MINIO_SECRET_KEY: Refusing the local development object-storage secret in production',
      );
    }
    if (!parsed.MINIO_PUBLIC_BASE_URL.startsWith('https://')) {
      throw new Error(
        'Invalid environment: MINIO_PUBLIC_BASE_URL: Production media URL must use https',
      );
    }
  }

  const smtpUser = blankToNull(parsed.SMTP_USER);
  const smtpPassword = blankToNull(parsed.SMTP_PASSWORD);

  return {
    nodeEnv: parsed.NODE_ENV,
    apiPort: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    sessionSecret: parsed.SESSION_SECRET,
    appOrigin: parsed.APP_ORIGIN,
    logLevel: parsed.LOG_LEVEL,
    smtpHost: parsed.SMTP_HOST,
    smtpPort: parsed.SMTP_PORT,
    smtpFrom: parsed.SMTP_FROM,
    smtpUser,
    smtpPassword,
    minioEndpoint: parsed.MINIO_ENDPOINT,
    minioAccessKey: parsed.MINIO_ACCESS_KEY,
    minioSecretKey: parsed.MINIO_SECRET_KEY,
    minioBucket: parsed.MINIO_BUCKET,
    minioPublicBaseUrl: parsed.MINIO_PUBLIC_BASE_URL.replace(/\/$/, ''),
    outboxPollIntervalMs: parsed.OUTBOX_POLL_INTERVAL_MS,
    outboxBackoffMs: parsed.OUTBOX_BACKOFF_MS,
    outboxQueueName: parsed.OUTBOX_QUEUE_NAME,
  };
}

function blankToNull(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  return value;
}
