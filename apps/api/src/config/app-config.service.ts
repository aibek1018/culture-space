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

  get smtpHost(): string {
    return this.config.smtpHost;
  }

  get smtpPort(): number {
    return this.config.smtpPort;
  }

  get smtpFrom(): string {
    return this.config.smtpFrom;
  }

  get smtpUser(): string | null {
    return this.config.smtpUser;
  }

  get smtpPassword(): string | null {
    return this.config.smtpPassword;
  }

  get minioEndpoint(): string {
    return this.config.minioEndpoint;
  }

  get minioAccessKey(): string {
    return this.config.minioAccessKey;
  }

  get minioSecretKey(): string {
    return this.config.minioSecretKey;
  }

  get minioBucket(): string {
    return this.config.minioBucket;
  }

  get minioPublicBaseUrl(): string {
    return this.config.minioPublicBaseUrl;
  }

  get outboxPollIntervalMs(): number {
    return this.config.outboxPollIntervalMs;
  }

  get outboxBackoffMs(): number {
    return this.config.outboxBackoffMs;
  }

  get outboxQueueName(): string {
    return this.config.outboxQueueName;
  }
}
