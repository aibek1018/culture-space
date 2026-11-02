import { Inject, Injectable } from '@nestjs/common';
import type { AppConfig } from './env.schema';

export const APP_CONFIG = Symbol('APP_CONFIG');

@Injectable()
export class AppConfigService {
  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  get nodeEnv(): AppConfig['nodeEnv'] {
    return this.config.nodeEnv;
  }

  get apiPort(): number {
    return this.config.apiPort;
  }

  get databaseUrl(): string {
    return this.config.databaseUrl;
  }

  get redisUrl(): string {
    return this.config.redisUrl;
  }

  get sessionSecret(): string {
    return this.config.sessionSecret;
  }

  get appOrigin(): string {
    return this.config.appOrigin;
  }

  get logLevel(): AppConfig['logLevel'] {
    return this.config.logLevel;
  }
}
