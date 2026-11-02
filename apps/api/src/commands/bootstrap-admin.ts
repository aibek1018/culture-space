import 'reflect-metadata';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DataSource } from 'typeorm';
import { validateEnv } from '../config/env.schema';
import {
  assertPasswordPolicy,
  assertUsername,
} from '../common/security/password-policy';
import { AppDataSource } from '../database/data-source';
import { UserEntity } from '../modules/users/entities/user.entity';
import { UserPreferenceEntity } from '../modules/users/entities/user-preference.entity';
import { PasswordService } from '../modules/auth/password.service';

for (const candidate of [
  resolve(process.cwd(), '.env'),
  resolve(process.cwd(), '../../.env'),
]) {
  if (existsSync(candidate)) {
    process.loadEnvFile(candidate);
  }
}

interface BootstrapInput {
  email: string;
  username: string;
  password: string;
  fullName: string;
  language: 'en' | 'ru';
}

export async function bootstrapAdministrator(
  dataSource: DataSource,
  input: BootstrapInput,
): Promise<'created' | 'exists'> {
  assertUsername(input.username);
  assertPasswordPolicy(input.password);
  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  if (fullName.length < 1 || fullName.length > 100) {
    throw new Error('BOOTSTRAP_ADMIN_FULL_NAME must be 1 to 100 characters');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('BOOTSTRAP_ADMIN_EMAIL must be an email address');
  }

  const users = dataSource.getRepository(UserEntity);
  const existing = await users
    .createQueryBuilder('user')
    .where('lower(user.email) = :email', { email })
    .getOne();
  if (existing) {
    if (existing.role !== 'ADMIN') {
      throw new Error(
        'An account with this email already exists and is not an administrator',
      );
    }
    return 'exists';
  }
  const usernameOwner = await users
    .createQueryBuilder('user')
    .where('lower(user.username) = lower(:username)', {
      username: input.username,
    })
    .getOne();
  if (usernameOwner) {
    throw new Error('BOOTSTRAP_ADMIN_USERNAME is already taken');
  }

  const passwords = new PasswordService();
  await passwords.onModuleInit();
  const passwordHash = await passwords.hash(input.password);
  const now = new Date();
  const id = randomUUID();
  await dataSource.transaction(async (manager) => {
    await manager.getRepository(UserEntity).insert({
      id,
      username: input.username,
      fullName,
      email,
      passwordHash,
      avatarUrl: null,
      bio: null,
      preferredLanguage: input.language,
      countryCode: null,
      role: 'ADMIN',
      profileVisibility: 'PUBLIC',
      libraryVisibility: 'PUBLIC',
      accountStatus: 'ACTIVE',
      emailVerifiedAt: now,
      createdAt: now,
      updatedAt: now,
    });
    await manager.getRepository(UserPreferenceEntity).insert({
      userId: id,
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
  });
  return 'created';
}

async function main(): Promise<void> {
  validateEnv({ ...process.env });
  const input = readBootstrapInput();
  await AppDataSource.initialize();
  try {
    const result = await bootstrapAdministrator(AppDataSource, input);
    if (result === 'exists') {
      process.stdout.write('Administrator already exists\n');
    } else {
      process.stdout.write('Administrator created\n');
    }
  } finally {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  }
}

function readBootstrapInput(): BootstrapInput {
  const email = required('BOOTSTRAP_ADMIN_EMAIL');
  const username = required('BOOTSTRAP_ADMIN_USERNAME');
  const password = required('BOOTSTRAP_ADMIN_PASSWORD');
  const fullName = required('BOOTSTRAP_ADMIN_FULL_NAME');
  const language = process.env.BOOTSTRAP_ADMIN_LANGUAGE ?? 'en';
  if (language !== 'en' && language !== 'ru') {
    throw new Error('BOOTSTRAP_ADMIN_LANGUAGE must be en or ru');
  }
  return { email, username, password, fullName, language };
}

function required(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim().length === 0) {
    throw new Error(`${name} is required`);
  }
  return value.trim();
}

if (require.main === module) {
  main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : 'Bootstrap failed';
    process.stderr.write(`${message}\n`);
    process.exit(1);
  });
}
