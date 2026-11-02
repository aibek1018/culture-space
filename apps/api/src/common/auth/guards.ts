import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { AccountRole } from '../graphql/enums';
import { DomainError } from '../errors/domain-error';
import { getCurrentAccount, type CurrentAccount } from './current-account';

export const ROLES_KEY = 'roles';

export const Roles = (...roles: AccountRole[]) => SetMetadata(ROLES_KEY, roles);

function accountFrom(context: ExecutionContext): CurrentAccount | null {
  const request = GqlExecutionContext.create(context).getContext<{
    req: Request;
  }>().req;
  return getCurrentAccount(request);
}

function assertActive(account: CurrentAccount | null): CurrentAccount {
  if (!account) {
    throw new DomainError(
      'UNAUTHENTICATED',
      'auth.unauthenticated',
      'Authentication is required',
    );
  }
  if (account.accountStatus !== 'ACTIVE' || account.loginSuspended) {
    throw new DomainError(
      'FORBIDDEN',
      'auth.account_restricted',
      'This account cannot perform that action',
    );
  }
  return account;
}

@Injectable()
export class AuthenticatedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    assertActive(accountFrom(context));
    return true;
  }
}

@Injectable()
export class VerifiedGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const account = assertActive(accountFrom(context));
    if (account.emailVerifiedAt === null) {
      throw new DomainError(
        'EMAIL_NOT_VERIFIED',
        'auth.email_not_verified',
        'Email verification is required',
      );
    }
    return true;
  }
}

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<
      AccountRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);
    if (required === undefined || required.length === 0) {
      return true;
    }
    const account = assertActive(accountFrom(context));
    const allowed = required.some((role) => roleAllows(role, account.role));
    if (!allowed) {
      throw new DomainError(
        'FORBIDDEN',
        'auth.forbidden',
        'You cannot perform that action',
      );
    }
    return true;
  }
}

function roleAllows(
  required: AccountRole,
  actual: CurrentAccount['role'],
): boolean {
  if (required === AccountRole.ADMIN) {
    return actual === 'ADMIN';
  }
  if (required === AccountRole.MODERATOR) {
    return actual === 'ADMIN' || actual === 'MODERATOR';
  }
  return true;
}
