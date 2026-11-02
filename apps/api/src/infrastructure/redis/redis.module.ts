import { Module } from '@nestjs/common';
import { RateLimitService } from './rate-limit.service';
import { RedisService } from './redis.service';

@Module({
  providers: [RedisService, RateLimitService],
  exports: [RedisService, RateLimitService],
})
export class RedisModule {}
