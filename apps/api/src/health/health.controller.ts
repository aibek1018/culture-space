import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';
import type { LivenessReport, ReadinessReport } from './health.types';

@Controller()
export class HealthController {
  constructor(private readonly health: HealthService) {}

  /**
   * Process liveness. Does not call PostgreSQL or Redis.
   */
  @Get('health')
  getHealth(): LivenessReport {
    return { status: 'ok' };
  }

  /**
   * Dependency readiness. Succeeds only when PostgreSQL and Redis both respond.
   */
  @Get('ready')
  async getReady(): Promise<ReadinessReport> {
    const report = await this.health.checkReadiness();
    if (report.status !== 'ok') {
      throw new HttpException(report, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return report;
  }
}
