import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.schema';
import { createTypeOrmOptions } from './typeorm-options';

for (const candidate of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

const config = validateEnv({ ...process.env });

export const AppDataSource = new DataSource(
  createTypeOrmOptions(config.databaseUrl),
);
