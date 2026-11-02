import { createRequire } from 'node:module';
import { createTypeOrmOptions } from './typeorm-options';

interface QueryResult<T extends Record<string, unknown>> {
  rows: T[];
}

interface PgClient {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T extends Record<string, unknown>>(
    sql: string,
  ): Promise<QueryResult<T>>;
}

interface PgModule {
  Client: new (config: { connectionString: string }) => PgClient;
}

const pgRequire = createRequire(__filename);
const { Client } = pgRequire('pg') as PgModule;

const EXPECTED_TABLES = [
  'users',
  'user_preferences',
  'email_verification_tokens',
  'password_reset_tokens',
  'user_restrictions',
  'follows',
  'outbox_messages',
  'typeorm_migrations',
] as const;

const ABSENT_TABLES = [
  'genres',
  'persons',
  'user_favorite_genres',
  'user_favorite_persons',
] as const;

const EXPECTED_CONSTRAINTS = [
  'users_username_check',
  'users_full_name_check',
  'users_email_lowercase_check',
  'users_bio_check',
  'users_preferred_language_check',
  'users_country_code_check',
  'users_role_check',
  'users_profile_visibility_check',
  'users_library_visibility_check',
  'users_account_status_check',
  'email_verification_tokens_token_hash_key',
  'password_reset_tokens_token_hash_key',
  'user_restrictions_type_check',
  'user_restrictions_reason_check',
  'follows_not_self_check',
  'follows_pair_unique',
  'outbox_messages_dedupe_key_key',
  'outbox_message_type_check',
  'outbox_not_processed_and_failed_check',
  'outbox_attempts_check',
] as const;

const EXPECTED_INDEXES = [
  'users_username_lower_uidx',
  'users_email_lower_uidx',
  'user_restrictions_one_active_uidx',
  'outbox_unpublished_idx',
  'outbox_failed_idx',
  'outbox_inflight_idx',
] as const;

const APPLIED_MIGRATION = 'CreateIdentityTables1730563200000';

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl === undefined || databaseUrl.length === 0) {
    throw new Error('DATABASE_URL is required');
  }

  const options = createTypeOrmOptions(databaseUrl);
  if (options.synchronize !== false) {
    throw new Error('TypeORM synchronize must be false');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const tables = await names(
      client,
      `SELECT tablename AS name FROM pg_tables WHERE schemaname = 'public'`,
    );
    requirePresent('table', EXPECTED_TABLES, tables);
    requireAbsent('table', ABSENT_TABLES, tables);

    const constraints = await names(
      client,
      `SELECT conname AS name
       FROM pg_constraint
       WHERE connamespace = 'public'::regnamespace`,
    );
    requirePresent('constraint', EXPECTED_CONSTRAINTS, constraints);

    const indexes = await names(
      client,
      `SELECT indexname AS name FROM pg_indexes WHERE schemaname = 'public'`,
    );
    requirePresent('index', EXPECTED_INDEXES, indexes);

    const extensions = await names(
      client,
      `SELECT extname AS name FROM pg_extension`,
    );
    requirePresent('extension', ['pg_trgm', 'unaccent'], extensions);

    const foreignKeys = await client.query<{
      table_name: string;
      delete_action: string;
    }>(
      `SELECT conrelid::regclass::text AS table_name, confdeltype AS delete_action
       FROM pg_constraint
       WHERE contype = 'f' AND connamespace = 'public'::regnamespace`,
    );
    const restrictOnRestrictions = foreignKeys.rows.some(
      (row) =>
        row.table_name === 'user_restrictions' && row.delete_action === 'r',
    );
    const cascadeOnFollows = foreignKeys.rows.some(
      (row) => row.table_name === 'follows' && row.delete_action === 'c',
    );
    if (!restrictOnRestrictions || !cascadeOnFollows) {
      throw new Error(
        'Foreign-key delete actions do not match the identity migration',
      );
    }

    const applied = await client.query<{ name: string }>(
      'SELECT name FROM typeorm_migrations ORDER BY id',
    );
    if (
      applied.rows.length !== 1 ||
      applied.rows[0]?.name !== APPLIED_MIGRATION
    ) {
      throw new Error(
        `Expected one applied migration ${APPLIED_MIGRATION}, found ${applied.rows.length}`,
      );
    }
  } finally {
    await client.end();
  }
}

async function names(client: PgClient, sql: string): Promise<Set<string>> {
  const result = await client.query<{ name: string }>(sql);
  return new Set(result.rows.map((row) => row.name));
}

function requirePresent(
  kind: string,
  expected: readonly string[],
  actual: Set<string>,
): void {
  const missing = expected.filter((name) => !actual.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing ${kind}: ${missing.join(', ')}`);
  }
}

function requireAbsent(
  kind: string,
  unexpected: readonly string[],
  actual: Set<string>,
): void {
  const present = unexpected.filter((name) => actual.has(name));
  if (present.length > 0) {
    throw new Error(`Unexpected ${kind}: ${present.join(', ')}`);
  }
}

void main().catch((error: unknown) => {
  const message =
    error instanceof Error ? error.message : 'Schema verification failed';
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
