import type { Logger, QueryRunner } from 'typeorm';

/**
 * Logs database failures without the bound parameters.
 * Those parameters can contain password hashes and email tokens.
 */
export class RedactingTypeOrmLogger implements Logger {
  logQuery(): void {}

  logQueryError(
    error: string | Error,
    _query: string,
    _parameters?: unknown[],
    _queryRunner?: QueryRunner,
  ): void {
    const message = error instanceof Error ? error.message : error;
    process.stderr.write(`database query failed: ${message}\n`);
  }

  logQuerySlow(): void {}

  logSchemaBuild(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  logMigration(message: string): void {
    process.stdout.write(`${message}\n`);
  }

  log(_level: 'log' | 'info' | 'warn', message: unknown): void {
    if (typeof message === 'string') {
      process.stdout.write(`${message}\n`);
    }
  }
}
