import {
  Injectable,
  Logger,
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
  SESSION_ABSOLUTE_TTL_SECONDS,
  SESSION_IDLE_TTL_SECONDS,
  SESSION_KEY_PREFIX,
  USER_SESSIONS_PREFIX,
} from './session.constants';
import './session-data';

type SessionHandler = (req: Request, res: Response, next: NextFunction) => void;

@Injectable()
export class SessionService implements NestMiddleware, OnModuleInit {
  private readonly logger = new Logger(SessionService.name);
  private store: RedisStore | null = null;
  private handler: SessionHandler | null = null;

  constructor(
    private readonly redis: RedisService,
    private readonly config: AppConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    const { RedisStore } = await import('connect-redis');
    this.store = new RedisStore({
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
        this.store,
      ),
    );
  }

  use(req: Request, res: Response, next: NextFunction): void {
    if (!this.handler) {
      next();
      return;
    }
    try {
      this.handler(req, res, (error?: unknown) => {
        if (error) {
          this.logger.error('Session store is unavailable');
          next();
          return;
        }
        next();
      });
    } catch {
      this.logger.error('Session store is unavailable');
      next();
    }
  }

  /**
   * Replaces the session id before storing the user id. This is the
   * session-fixation control for login and registration.
   */
  async establish(req: Request, userId: string): Promise<void> {
    const previousId = req.sessionID;
    await this.regenerate(req);
    req.session.userId = userId;
    req.session.issuedAt = Date.now();
    await this.save(req);
    if (previousId.length > 0 && previousId !== req.sessionID) {
      await this.safeConnect();
      await this.redis.client.sRem(this.sessionsKey(userId), previousId);
      await this.destroyId(previousId);
    }
    await this.track(userId, req.sessionID);
  }

  async logout(req: Request): Promise<void> {
    const userId = req.session.userId;
    const sessionId = req.sessionID;
    if (userId !== undefined) {
      await this.safeConnect();
      await this.redis.client.sRem(this.sessionsKey(userId), sessionId);
    }
    await this.destroyRequest(req);
  }

  async invalidateAll(userId: string): Promise<void> {
    await this.safeConnect();
    const key = this.sessionsKey(userId);
    const ids = await this.redis.client.sMembers(key);
    for (const id of ids) {
      await this.destroyId(id);
    }
    await this.redis.client.del(key);
  }

  async invalidateOthers(userId: string, keepSessionId: string): Promise<void> {
    await this.safeConnect();
    const key = this.sessionsKey(userId);
    const ids = await this.redis.client.sMembers(key);
    for (const id of ids) {
      if (id === keepSessionId) {
        continue;
      }
      await this.destroyId(id);
      await this.redis.client.sRem(key, id);
    }
  }

  async touchIndex(userId: string, sessionId: string): Promise<void> {
    await this.track(userId, sessionId);
  }

  private async track(userId: string, sessionId: string): Promise<void> {
    await this.safeConnect();
    const key = this.sessionsKey(userId);
    await this.redis.client.sAdd(key, sessionId);
    await this.redis.client.expire(key, SESSION_ABSOLUTE_TTL_SECONDS);
  }

  private sessionsKey(userId: string): string {
    return `${USER_SESSIONS_PREFIX}${userId}`;
  }

  private async regenerate(req: Request): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async save(req: Request): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      req.session.save((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async destroyRequest(req: Request): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private async destroyId(sessionId: string): Promise<void> {
    if (!this.store) {
      return;
    }
    await new Promise<void>((resolve) => {
      this.store?.destroy(sessionId, () => {
        resolve();
      });
    });
  }

  private async safeConnect(): Promise<void> {
    if (this.redis.client.isOpen) {
      return;
    }
    try {
      await this.redis.client.connect();
    } catch (error) {
      if (this.redis.client.isOpen) {
        return;
      }
      this.logger.error('Redis session index is unavailable');
      throw error;
    }
  }
}
