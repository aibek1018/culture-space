import { Inject, Injectable, type NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { isAbsoluteSessionExpired } from '../security/session-lifetime';
import { SessionService } from '../../infrastructure/session/session.service';
import {
  ACCOUNT_READER,
  setCurrentAccount,
  type AccountReader,
} from './current-account';

@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(
    private readonly sessions: SessionService,
    @Inject(ACCOUNT_READER) private readonly accounts: AccountReader,
  ) {}

  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.session?.userId;
      if (userId === undefined) {
        setCurrentAccount(req, null);
        next();
        return;
      }
      if (isAbsoluteSessionExpired(req.session.issuedAt, Date.now())) {
        await this.sessions.logout(req);
        setCurrentAccount(req, null);
        next();
        return;
      }
      const account = await this.accounts.loadCurrentAccount(userId);
      if (!account) {
        await this.sessions.logout(req);
        setCurrentAccount(req, null);
        next();
        return;
      }
      await this.sessions.touchIndex(account.id, req.sessionID);
      setCurrentAccount(req, account);
      next();
    } catch (error) {
      next(error);
    }
  }
}
