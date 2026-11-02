import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AppConfigService } from '../config/app-config.service';
import { createTypeOrmOptions } from './typeorm-options';

/**
 * Owns the TypeORM DataSource.
 * A failed connection does not stop the process: GET /ready reports it.
 */
@Injectable()
export class PostgresConnection implements OnModuleDestroy {
  private readonly logger = new Logger(PostgresConnection.name);
  private readonly dataSource: DataSource;
  private connecting: Promise<void> | null = null;

  constructor(config: AppConfigService) {
    this.dataSource = new DataSource(createTypeOrmOptions(config.databaseUrl));
  }

  getDataSource(): DataSource {
    return this.dataSource;
  }

  async ping(): Promise<boolean> {
    try {
      await this.ensureInitialized();
      await this.dataSource.query('SELECT 1');
      return true;
    } catch {
      this.logger.error('PostgreSQL readiness check failed');
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.dataSource.isInitialized) {
      await this.dataSource.destroy();
    }
  }

  private async ensureInitialized(): Promise<void> {
    if (this.dataSource.isInitialized) {
      return;
    }

    if (!this.connecting) {
      this.connecting = this.dataSource
        .initialize()
        .then(() => undefined)
        .finally(() => {
          this.connecting = null;
        });
    }

    await this.connecting;
  }
}
