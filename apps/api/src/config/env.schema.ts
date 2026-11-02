import { z } from 'zod';

/** Local Compose and `.env.example` value. Production startup rejects it. */
export const LOCAL_DEVELOPMENT_SESSION_SECRET =
  'dev-only-session-secret-change-me!!';

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
  }

  return {
    nodeEnv: parsed.NODE_ENV,
    apiPort: parsed.API_PORT,
    databaseUrl: parsed.DATABASE_URL,
    redisUrl: parsed.REDIS_URL,
    sessionSecret: parsed.SESSION_SECRET,
    appOrigin: parsed.APP_ORIGIN,
    logLevel: parsed.LOG_LEVEL,
  };
}
