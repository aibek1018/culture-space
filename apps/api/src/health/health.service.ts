import { Injectable } from '@nestjs/common';
import { PostgresConnection } from '../database/postgres.connection';
import { RedisService } from '../infrastructure/redis/redis.service';
import type { DependencyStatus, ReadinessReport } from './health.types';

const READINESS_TIMEOUT_MS = 3000;

@Injectable()
export class HealthService {
  constructor(
    private readonly postgres: PostgresConnection,
    private readonly redis: RedisService,
  ) {}

  async checkReadiness(): Promise<ReadinessReport> {
    const [postgres, redis] = await Promise.all([
      this.withTimeout(this.postgres.ping()),
      this.withTimeout(this.redis.ping()),
    ]);

    const checks = {
      postgres: this.toStatus(postgres),
      redis: this.toStatus(redis),
    };

    return {
      status: postgres && redis ? 'ok' : 'unavailable',
      checks,
    };
  }

  private toStatus(up: boolean): DependencyStatus {
    return up ? 'up' : 'down';
  }

  private async withTimeout(check: Promise<boolean>): Promise<boolean> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<boolean>((resolve) => {
      timer = setTimeout(() => resolve(false), READINESS_TIMEOUT_MS);
    });

    try {
      return await Promise.race([check.catch(() => false), timeout]);
    } finally {
      if (timer !== undefined) {
        clearTimeout(timer);
      }
    }
  }
}
