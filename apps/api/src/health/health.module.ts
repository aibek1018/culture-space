import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module';
import { RedisModule } from '../infrastructure/redis/redis.module';
import { FoundationHealthResolver } from './foundation-health.resolver';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [DatabaseModule, RedisModule],
  controllers: [HealthController],
  providers: [HealthService, FoundationHealthResolver],
})
export class HealthModule {}
