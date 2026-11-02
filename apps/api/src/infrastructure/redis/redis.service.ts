import { Injectable, Logger, type OnModuleDestroy } from '@nestjs/common';
import { createClient, type RedisClientType } from 'redis';
import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  readonly client: RedisClientType;

  constructor(config: AppConfigService) {
    this.client = createClient({
      url: config.redisUrl,
      socket: {
        connectTimeout: 2000,
        reconnectStrategy: (retries: number) => {
          if (retries > 3) {
            return new Error('Redis unavailable');
          }
          return Math.min(retries * 200, 1000);
        },
      },
    });

    this.client.on('error', () => {
      this.logger.error('Redis client error');
    });
  }

  async ping(): Promise<boolean> {
    try {
      if (!this.client.isOpen) {
        await this.client.connect();
      }
      const result = await this.client.ping();
      return result === 'PONG';
    } catch {
      this.logger.error('Redis readiness check failed');
      return false;
    }
  }

  async onModuleDestroy(): Promise<void> {
    try {
      if (this.client.isOpen) {
        await this.client.quit();
      }
    } catch {
      this.client.disconnect();
    }
  }
}
