import {
  Injectable,
  type NestMiddleware,
  type OnModuleInit,
} from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import session from 'express-session';
import type { RedisStore } from 'connect-redis';
import { AppConfigService } from '../../config/app-config.service';
import { RedisService } from '../redis/redis.service';
import { createSessionOptions } from './session-options';
import {
  SESSION_IDLE_TTL_SECONDS,
  SESSION_KEY_PREFIX,
} from './session.constants';
import './session-data';

type SessionHandler = (req: Request, res: Response, next: NextFunction) => void;

/**
 * Redis-backed session middleware for the future auth module.
 * Mounted only on /graphql so /health and /ready do not require Redis.
 * Issuing, regenerating, and revoking sessions is Milestone 2.
 */
@Injectable()
export class SessionMiddleware implements NestMiddleware, OnModuleInit {
  private handler: SessionHandler | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { RedisStore } = await import('connect-redis');
    const store: RedisStore = new RedisStore({
      client: this.redis.client,
      prefix: SESSION_KEY_PREFIX,
      ttl: SESSION_IDLE_TTL_SECONDS,
    });

    this.handler = session(
      createSessionOptions(
        {
          nodeEnv: this.config.nodeEnv,
          sessionSecret: this.config.sessionSecret,
        },
        store,
      ),
    );
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.handler) {
      next(new Error('Session middleware is not initialized'));
      return;
    }
    this.handler(req, res, next);
  }
}
