import type { DataSourceOptions } from 'typeorm';
import { CreateIdentityTables1730563200000 } from './migrations/1730563200000-create-identity-tables';
import { identityEntities } from './identity-entities';
import { RedactingTypeOrmLogger } from './redacting-typeorm-logger';

/**
 * Schema changes arrive only as migrations.
 * `synchronize` is unconditional so no environment can turn it on.
 */
export function createTypeOrmOptions(databaseUrl: string): DataSourceOptions {
  return {
    type: 'postgres',
    url: databaseUrl,
    synchronize: false,
    migrations: [CreateIdentityTables1730563200000],
    migrationsTableName: 'typeorm_migrations',
    entities: identityEntities,
    logging: ['error'],
    logger: new RedactingTypeOrmLogger(),
    extra: {
      connectionTimeoutMillis: 2000,
    },
  };
}
