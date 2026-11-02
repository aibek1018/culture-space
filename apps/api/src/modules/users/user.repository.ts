import { Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';
import { PostgresConnection } from '../../database/postgres.connection';
import type { CurrentAccount } from '../../common/auth/current-account';
import { UserEntity } from './entities/user.entity';
import { UserPreferenceEntity } from './entities/user-preference.entity';
import { UserRestrictionEntity } from './entities/user-restriction.entity';

export interface LoginRecord {
  id: string;
  email: string;
  passwordHash: string;
  role: UserEntity['role'];
  accountStatus: UserEntity['accountStatus'];
  preferredLanguage: UserEntity['preferredLanguage'];
}

@Injectable()
export class UserRepository {
  constructor(private readonly postgres: PostgresConnection) {}

  async manager(): Promise<EntityManager> {
    await this.postgres.ensureInitialized();
    return this.postgres.getDataSource().manager;
  }

  async findById(
    id: string,
    manager?: EntityManager,
  ): Promise<UserEntity | null> {
    const repo = (manager ?? (await this.manager())).getRepository(UserEntity);
    return repo.findOne({ where: { id } });
  }

  async findByEmail(
    email: string,
    manager?: EntityManager,
  ): Promise<UserEntity | null> {
    return (manager ?? (await this.manager()))
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where('lower(user.email) = :email', { email })
      .getOne();
  }

  async findByUsername(
    username: string,
    manager?: EntityManager,
  ): Promise<UserEntity | null> {
    return (manager ?? (await this.manager()))
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .where('lower(user.username) = lower(:username)', { username })
      .getOne();
  }

  async findLoginByEmail(email: string): Promise<LoginRecord | null> {
    const row = await (
      await this.manager()
    )
      .getRepository(UserEntity)
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('lower(user.email) = :email', { email })
      .getOne();
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      email: row.email,
      passwordHash: row.passwordHash,
      role: row.role,
      accountStatus: row.accountStatus,
      preferredLanguage: row.preferredLanguage,
    };
  }

  async findPreferences(
    userId: string,
    manager?: EntityManager,
  ): Promise<UserPreferenceEntity | null> {
    return (manager ?? (await this.manager()))
      .getRepository(UserPreferenceEntity)
      .findOne({ where: { userId } });
  }

  async loadCurrentAccount(userId: string): Promise<CurrentAccount | null> {
    const user = await this.findById(userId);
    if (!user) {
      return null;
    }
    const [loginSuspended, postingSuspended] = await Promise.all([
      this.hasActiveRestriction(userId, 'LOGIN_SUSPENDED'),
      this.hasActiveRestriction(userId, 'POSTING_SUSPENDED'),
    ]);
    return {
      id: user.id,
      role: user.role,
      accountStatus: user.accountStatus,
      emailVerifiedAt: user.emailVerifiedAt,
      loginSuspended,
      postingSuspended,
    };
  }

  async hasActiveRestriction(
    userId: string,
    type: UserRestrictionEntity['type'],
    manager?: EntityManager,
  ): Promise<boolean> {
    const count = await (manager ?? (await this.manager()))
      .getRepository(UserRestrictionEntity)
      .createQueryBuilder('restriction')
      .where('restriction.userId = :userId', { userId })
      .andWhere('restriction.type = :type', { type })
      .andWhere('restriction.revokedAt IS NULL')
      .andWhere(
        '(restriction.expiresAt IS NULL OR restriction.expiresAt > now())',
      )
      .getCount();
    return count > 0;
  }
}
