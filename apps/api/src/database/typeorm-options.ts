import { join } from 'node:path';
import type { DataSourceOptions } from 'typeorm';

/**
 * Schema changes arrive only as migrations.
 * `synchronize` is unconditional so no environment can turn it on.
 */
export function createTypeOrmOptions(databaseUrl: string): DataSourceOptions {
  const migrationExtension = __filename.endsWith('.js') ? 'js' : 'ts';

  return {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    migrations: [join(__dirname, 'migrations', `*.${migrationExtension}`)],
    migrationsTableName: 'typeorm_migrations',
    entities: [],
    logging: ['error'],
    extra: {
      connectionTimeoutMillis: 2000,
    },
  };
}
