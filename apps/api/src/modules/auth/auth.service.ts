import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { AppConfigService } from '../../config/app-config.service';
import type { CurrentAccount } from '../../common/auth/current-account';
import { DomainError } from '../../common/errors/domain-error';
import { assertUsername } from '../../common/security/password-policy';
import {
  createRawToken,
  hashToken,
  PASSWORD_RESET_TOKEN_TTL_MS,
  VERIFICATION_TOKEN_TTL_MS,
} from '../../common/security/tokens';
import {
  toDatabaseLanguage,
  type InterfaceLanguage,
} from '../../common/graphql/enums';
import { OutboxRuntime } from '../../infrastructure/outbox/outbox.runtime';
import { RateLimitService } from '../../infrastructure/redis/rate-limit.service';
import { SessionService } from '../../infrastructure/session/session.service';
import { PostgresConnection } from '../../database/postgres.connection';
import { EmailVerificationTokenEntity } from '../users/entities/email-verification-token.entity';
import { PasswordResetTokenEntity } from '../users/entities/password-reset-token.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UserPreferenceEntity } from '../users/entities/user-preference.entity';
import {
  mapIdentityConflict,
  ProfileService,
  type AccountView,
} from '../users/profile.service';
import { UserRepository } from '../users/user.repository';
import { passwordResetEmail, verificationEmail } from './mail-messages';
import { PasswordService } from './password.service';

export interface RegisterCommand {
  username: string;
  fullName: string;
  email: string;
  password: string;
  preferredLanguage: InterfaceLanguage;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly postgres: PostgresConnection,
    private readonly users: UserRepository,
    private readonly profiles: ProfileService,
    private readonly passwords: PasswordService,
    private readonly sessions: SessionService,
    private readonly outbox: OutboxRuntime,
    private readonly rateLimit: RateLimitService,
    private readonly config: AppConfigService,
  ) {}

  async register(
    command: RegisterCommand,
    ip: string,
    request: Request,
  ): Promise<AccountView> {
    await this.rateLimit.assertRegistrationAllowed(ip);
    const username = command.username.trim();
    assertUsername(username);
    const email = normalizeEmail(command.email);
    const fullName = command.fullName.trim();
    if (fullName.length < 1 || fullName.length > 100) {
      throw new DomainError(
        'VALIDATION',
        'validation.invalid',
        'Full name must be 1 to 100 characters',
      );
    }
    const passwordHash = await this.passwords.hash(command.password);
    const now = new Date();
    const userId = randomUUID();
    const tokenId = randomUUID();
    const rawToken = createRawToken();
    const language = toDatabaseLanguage(command.preferredLanguage);
    const mail = verificationEmail({
      origin: this.config.appOrigin,
      language,
      rawToken,
    });

    await this.postgres.ensureInitialized();
    try {
      await this.postgres.getDataSource().transaction(async (manager) => {
        await manager.getRepository(UserEntity).insert({
          id: userId,
          username,
          fullName,
          email,
          passwordHash,
          avatarUrl: null,
          bio: null,
          preferredLanguage: language,
          countryCode: null,
          role: 'USER',
          profileVisibility: 'PUBLIC',
          libraryVisibility: 'PUBLIC',
          accountStatus: 'ACTIVE',
          emailVerifiedAt: null,
          createdAt: now,
          updatedAt: now,
        });
        await manager.getRepository(UserPreferenceEntity).insert({
          userId,
          showSpoilers: false,
          notifyNewFollower: true,
          notifyReviewLike: true,
          notifyDiscussionLike: true,
          notifyCommentReply: true,
          notifyNewComment: true,
          notifyClubInvitation: true,
          notifyClubMembership: true,
          notifyClubActivity: true,
          notifyClubAnnouncement: true,
          updatedAt: now,
        });
        await manager.getRepository(EmailVerificationTokenEntity).insert({
          id: tokenId,
          userId,
          tokenHash: hashToken(rawToken),
          expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
          usedAt: null,
          createdAt: now,
        });
        await this.outbox.insert(manager, {
          id: randomUUID(),
          messageType: 'SEND_EMAIL',
          dedupeKey: `email-verification:${tokenId}`,
          availableAt: now,
          payload: { to: email, subject: mail.subject, text: mail.text },
        });
      });
    } catch (error) {
      throw mapIdentityConflict(error);
    }

    await this.sessions.establish(request, userId);
    return this.profiles.getAccount(userId);
  }

  async login(
    emailInput: string,
    password: string,
    ip: string,
    request: Request,
  ): Promise<AccountView> {
    const email = emailInput.trim().toLowerCase();
    await this.rateLimit.assertLoginAllowed(email, ip);
    const record = await this.users.findLoginByEmail(email);
    const matches = await this.passwords.verify(
      record?.passwordHash ?? null,
      password,
    );
    if (!record || !matches) {
      await this.rateLimit.recordLoginFailure(email, ip);
      throw new DomainError(
        'UNAUTHENTICATED',
        'auth.invalid_credentials',
        'Invalid email or password',
      );
    }
    const loginSuspended = await this.users.hasActiveRestriction(
      record.id,
      'LOGIN_SUSPENDED',
    );
    if (record.accountStatus !== 'ACTIVE' || loginSuspended) {
      throw new DomainError(
        'FORBIDDEN',
        'auth.account_restricted',
        'This account cannot sign in',
      );
    }
    await this.sessions.establish(request, record.id);
    return this.profiles.getAccount(record.id);
  }

  async logout(request: Request): Promise<boolean> {
    await this.sessions.logout(request);
    return true;
  }

  async logoutAll(account: CurrentAccount, request: Request): Promise<boolean> {
    await this.sessions.invalidateAll(account.id);
    await this.sessions.logout(request);
    return true;
  }

  async verifyEmail(rawToken: string): Promise<AccountView> {
    const token = await this.findVerificationToken(rawToken);
    const now = new Date();
    await this.postgres.ensureInitialized();
    await this.postgres.getDataSource().transaction(async (manager) => {
      await manager
        .getRepository(EmailVerificationTokenEntity)
        .update({ id: token.id }, { usedAt: now });
      await manager
        .getRepository(UserEntity)
        .createQueryBuilder()
        .update()
        .set({ emailVerifiedAt: now, updatedAt: now })
        .where('id = :id', { id: token.userId })
        .andWhere('email_verified_at IS NULL')
        .execute();
    });
    return this.profiles.getAccount(token.userId);
  }

  async resendVerification(account: CurrentAccount): Promise<boolean> {
    const user = await this.users.findById(account.id);
    if (!user || user.emailVerifiedAt !== null) {
      return true;
    }
    const now = new Date();
    const tokenId = randomUUID();
    const rawToken = createRawToken();
    const mail = verificationEmail({
      origin: this.config.appOrigin,
      language: user.preferredLanguage,
      rawToken,
    });
    await this.postgres.ensureInitialized();
    await this.postgres.getDataSource().transaction(async (manager) => {
      await manager.getRepository(EmailVerificationTokenEntity).insert({
        id: tokenId,
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + VERIFICATION_TOKEN_TTL_MS),
        usedAt: null,
        createdAt: now,
      });
      await this.outbox.insert(manager, {
        id: randomUUID(),
        messageType: 'SEND_EMAIL',
        dedupeKey: `email-verification:${tokenId}`,
        availableAt: now,
        payload: { to: user.email, subject: mail.subject, text: mail.text },
      });
    });
    return true;
  }

  async requestPasswordReset(emailInput: string): Promise<boolean> {
    const email = emailInput.trim().toLowerCase();
    const allowed = await this.rateLimit.passwordResetAllowed(email);
    if (!allowed) {
      return true;
    }
    const user = await this.users.findByEmail(email);
    if (!user) {
      return true;
    }
    const now = new Date();
    const tokenId = randomUUID();
    const rawToken = createRawToken();
    const mail = passwordResetEmail({
      origin: this.config.appOrigin,
      language: user.preferredLanguage,
      rawToken,
    });
    await this.postgres.ensureInitialized();
    await this.postgres.getDataSource().transaction(async (manager) => {
      await manager.getRepository(PasswordResetTokenEntity).insert({
        id: tokenId,
        userId: user.id,
        tokenHash: hashToken(rawToken),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TOKEN_TTL_MS),
        usedAt: null,
        createdAt: now,
      });
      await this.outbox.insert(manager, {
        id: randomUUID(),
        messageType: 'SEND_EMAIL',
        dedupeKey: `password-reset:${tokenId}`,
        availableAt: now,
        payload: { to: user.email, subject: mail.subject, text: mail.text },
      });
    });
    return true;
  }

  async resetPassword(rawToken: string, newPassword: string): Promise<boolean> {
    const token = await this.findResetToken(rawToken);
    const passwordHash = await this.passwords.hash(newPassword);
    const now = new Date();
    await this.postgres.ensureInitialized();
    await this.postgres.getDataSource().transaction(async (manager) => {
      await manager
        .getRepository(PasswordResetTokenEntity)
        .createQueryBuilder()
        .update()
        .set({ usedAt: now })
        .where('user_id = :userId AND used_at IS NULL', {
          userId: token.userId,
        })
        .execute();
      await manager
        .getRepository(UserEntity)
        .update({ id: token.userId }, { passwordHash, updatedAt: now });
      await this.outbox.insert(manager, {
        id: randomUUID(),
        messageType: 'INVALIDATE_SESSIONS',
        dedupeKey: `invalidate-sessions:password-reset:${token.id}`,
        availableAt: now,
        payload: { userId: token.userId },
      });
    });
    return true;
  }

  async changePassword(
    account: CurrentAccount,
    currentPassword: string,
    newPassword: string,
    request: Request,
  ): Promise<boolean> {
    const record = await this.users.findLoginByEmail(
      await this.requireEmail(account.id),
    );
    const matches = await this.passwords.verify(
      record?.passwordHash ?? null,
      currentPassword,
    );
    if (!record || record.id !== account.id || !matches) {
      throw new DomainError(
        'VALIDATION',
        'auth.current_password_invalid',
        'The current password is incorrect',
      );
    }
    const passwordHash = await this.passwords.hash(newPassword);
    await this.postgres.ensureInitialized();
    await this.postgres
      .getDataSource()
      .getRepository(UserEntity)
      .update({ id: account.id }, { passwordHash, updatedAt: new Date() });
    await this.sessions.invalidateOthers(account.id, request.sessionID);
    return true;
  }

  private async requireEmail(userId: string): Promise<string> {
    const user = await this.users.findById(userId);
    if (!user) {
      throw new DomainError(
        'UNAUTHENTICATED',
        'auth.unauthenticated',
        'Authentication is required',
      );
    }
    return user.email;
  }

  private async findVerificationToken(
    rawToken: string,
  ): Promise<EmailVerificationTokenEntity> {
    return this.findToken(EmailVerificationTokenEntity, rawToken);
  }

  private async findResetToken(
    rawToken: string,
  ): Promise<PasswordResetTokenEntity> {
    return this.findToken(PasswordResetTokenEntity, rawToken);
  }

  private async findToken<
    T extends {
      id: string;
      userId: string;
      expiresAt: Date;
      usedAt: Date | null;
    },
  >(entity: new () => T, rawToken: string): Promise<T> {
    const manager = await this.users.manager();
    const token = await manager.getRepository(entity).findOne({
      where: { tokenHash: hashToken(rawToken) } as object,
    });
    if (
      !token ||
      token.usedAt !== null ||
      token.expiresAt.getTime() <= Date.now()
    ) {
      throw new DomainError(
        'VALIDATION',
        'auth.token_invalid',
        'This link is invalid or has expired',
      );
    }
    return token;
  }
}

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (
    normalized.length < 3 ||
    normalized.length > 320 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)
  ) {
    throw new DomainError(
      'VALIDATION',
      'validation.invalid',
      'Enter a valid email address',
    );
  }
  return normalized;
}
