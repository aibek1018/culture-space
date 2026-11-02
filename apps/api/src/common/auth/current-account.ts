import type { ExecutionContext } from '@nestjs/common';
import { createParamDecorator } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';

export interface CurrentAccount {
  id: string;
  role: 'USER' | 'MODERATOR' | 'ADMIN';
  accountStatus: 'ACTIVE' | 'SUSPENDED';
  emailVerifiedAt: Date | null;
  loginSuspended: boolean;
  postingSuspended: boolean;
}

export interface AccountReader {
  loadCurrentAccount(userId: string): Promise<CurrentAccount | null>;
}

export const ACCOUNT_READER = Symbol('ACCOUNT_READER');

const accounts = new WeakMap<Request, CurrentAccount | null>();

export function setCurrentAccount(
  request: Request,
  account: CurrentAccount | null,
): void {
  accounts.set(request, account);
}

export function getCurrentAccount(request: Request): CurrentAccount | null {
  return accounts.get(request) ?? null;
}

export const CurrentAccountParam = createParamDecorator(
  (_data: unknown, context: ExecutionContext): CurrentAccount | null => {
    const request = GqlExecutionContext.create(context).getContext<{
      req: Request;
    }>().req;
    return getCurrentAccount(request);
  },
);
