import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import {
  postgresConstraint,
  postgresErrorCode,
} from '../../common/errors/database-error';
import { assertUsername } from '../../common/security/password-policy';
import {
  fromDatabaseLanguage,
  toDatabaseLanguage,
  type InterfaceLanguage,
} from '../../common/graphql/enums';
import { emptyToNull, parseCountryCode } from './country-code';
import { UserPreferenceEntity } from './entities/user-preference.entity';
import { UserEntity } from './entities/user.entity';
import {
  applyPrivacyUpdate,
  toPublicProfile,
  type PublicProfile,
} from './privacy';
import { UserRepository } from './user.repository';

export interface PreferenceView {
  showSpoilers: boolean;
  notifyNewFollower: boolean;
  notifyReviewLike: boolean;
  notifyDiscussionLike: boolean;
  notifyCommentReply: boolean;
  notifyNewComment: boolean;
  notifyClubInvitation: boolean;
  notifyClubMembership: boolean;
  notifyClubActivity: boolean;
  notifyClubAnnouncement: boolean;
}

export interface AccountView {
  id: string;
  username: string;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  bio: string | null;
  preferredLanguage: InterfaceLanguage;
  countryCode: string | null;
  role: UserEntity['role'];
  profileVisibility: UserEntity['profileVisibility'];
  libraryVisibility: UserEntity['libraryVisibility'];
  emailVerifiedAt: Date | null;
  createdAt: Date;
  preferences: PreferenceView;
}

export interface ProfilePatch {
  fullName?: string;
  bio?: string | null;
  countryCode?: string | null;
  preferredLanguage?: InterfaceLanguage;
  username?: string;
}

@Injectable()
export class ProfileService {
  constructor(private readonly users: UserRepository) {}

  async getAccount(userId: string): Promise<AccountView> {
    const manager = await this.users.manager();
    const user = await this.users.findById(userId, manager);
    const preferences = await this.users.findPreferences(userId, manager);
    if (!user || !preferences) {
      throw new DomainError('NOT_FOUND', 'users.not_found', 'User not found');
    }
    return toAccount(user, preferences);
  }

  async getPublicProfile(
    username: string,
    viewerId: string | null,
  ): Promise<PublicProfile> {
    const user = await this.requireByUsername(username);
    const counts = await this.counts(user.id);
    const followed = viewerId
      ? await this.isFollowed(viewerId, user.id)
      : false;
    return toPublicProfile(user, counts, followed);
  }

  async updateProfile(
    userId: string,
    patch: ProfilePatch,
  ): Promise<AccountView> {
    const manager = await this.users.manager();
    const user = await this.users.findById(userId, manager);
    if (!user) {
      throw new DomainError('NOT_FOUND', 'users.not_found', 'User not found');
    }
    if (patch.username !== undefined) {
      assertUsername(patch.username);
      user.username = patch.username;
    }
    if (patch.fullName !== undefined) {
      const fullName = patch.fullName.trim();
      if (fullName.length < 1 || fullName.length > 100) {
        throw new DomainError(
          'VALIDATION',
          'validation.invalid',
          'Full name must be 1 to 100 characters',
        );
      }
      user.fullName = fullName;
    }
    if (patch.bio !== undefined) {
      const bio = emptyToNull(patch.bio);
      if (bio !== undefined && bio !== null && bio.length > 500) {
        throw new DomainError(
          'VALIDATION',
          'validation.invalid',
          'Bio must be at most 500 characters',
        );
      }
      user.bio = bio ?? null;
    }
    if (patch.countryCode !== undefined) {
      user.countryCode =
        patch.countryCode === null ? null : parseCountryCode(patch.countryCode);
    }
    if (patch.preferredLanguage !== undefined) {
      user.preferredLanguage = toDatabaseLanguage(patch.preferredLanguage);
    }
    user.updatedAt = new Date();
    try {
      await manager.getRepository(UserEntity).save(user);
    } catch (error) {
      throw mapIdentityConflict(error);
    }
    return this.getAccount(userId);
  }

  async updatePreferences(
    userId: string,
    patch: Partial<PreferenceView>,
  ): Promise<PreferenceView> {
    const manager = await this.users.manager();
    const preferences = await this.users.findPreferences(userId, manager);
    if (!preferences) {
      throw new DomainError('NOT_FOUND', 'users.not_found', 'User not found');
    }
    assignDefined(preferences, patch);
    preferences.updatedAt = new Date();
    await manager.getRepository(UserPreferenceEntity).save(preferences);
    return toPreferences(preferences);
  }

  async updatePrivacy(
    userId: string,
    input: {
      profileVisibility: UserEntity['profileVisibility'];
      libraryVisibility: UserEntity['libraryVisibility'];
    },
  ): Promise<AccountView> {
    const manager = await this.users.manager();
    const user = await this.users.findById(userId, manager);
    if (!user) {
      throw new DomainError('NOT_FOUND', 'users.not_found', 'User not found');
    }
    const next = applyPrivacyUpdate(input);
    user.profileVisibility = next.profileVisibility;
    user.libraryVisibility = next.libraryVisibility;
    user.updatedAt = new Date();
    await manager.getRepository(UserEntity).save(user);
    return this.getAccount(userId);
  }

  async setAvatarUrl(userId: string, avatarUrl: string): Promise<AccountView> {
    const manager = await this.users.manager();
    const user = await this.users.findById(userId, manager);
    if (!user) {
      throw new DomainError('NOT_FOUND', 'users.not_found', 'User not found');
    }
    user.avatarUrl = avatarUrl;
    user.updatedAt = new Date();
    await manager.getRepository(UserEntity).save(user);
    return this.getAccount(userId);
  }

  async counts(
    userId: string,
  ): Promise<{ followers: number; following: number }> {
    const manager = await this.users.manager();
    const rows: unknown = await manager.query(
      `SELECT
         (SELECT count(*)::int FROM follows WHERE following_id = $1) AS followers,
         (SELECT count(*)::int FROM follows WHERE follower_id = $1) AS following`,
      [userId],
    );
    const row = Array.isArray(rows) ? rows[0] : undefined;
    const followers =
      typeof row === 'object' && row !== null
        ? Reflect.get(row, 'followers')
        : 0;
    const following =
      typeof row === 'object' && row !== null
        ? Reflect.get(row, 'following')
        : 0;
    return {
      followers:
        typeof followers === 'number' ? followers : Number(followers) || 0,
      following:
        typeof following === 'number' ? following : Number(following) || 0,
    };
  }

  async isFollowed(viewerId: string, userId: string): Promise<boolean> {
    const manager = await this.users.manager();
    const rows: unknown = await manager.query(
      `SELECT 1 FROM follows WHERE follower_id = $1 AND following_id = $2 LIMIT 1`,
      [viewerId, userId],
    );
    return Array.isArray(rows) && rows.length > 0;
  }

  async requireByUsername(username: string): Promise<UserEntity> {
    const user = await this.users.findByUsername(username);
    if (!user) {
      throw new DomainError('NOT_FOUND', 'users.not_found', 'User not found');
    }
    return user;
  }
}

export function toAccount(
  user: UserEntity,
  preferences: UserPreferenceEntity,
): AccountView {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    email: user.email,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    preferredLanguage: fromDatabaseLanguage(user.preferredLanguage),
    countryCode: user.countryCode?.trim() || null,
    role: user.role,
    profileVisibility: user.profileVisibility,
    libraryVisibility: user.libraryVisibility,
    emailVerifiedAt: user.emailVerifiedAt,
    createdAt: user.createdAt,
    preferences: toPreferences(preferences),
  };
}

export function toPreferences(
  preferences: UserPreferenceEntity,
): PreferenceView {
  return {
    showSpoilers: preferences.showSpoilers,
    notifyNewFollower: preferences.notifyNewFollower,
    notifyReviewLike: preferences.notifyReviewLike,
    notifyDiscussionLike: preferences.notifyDiscussionLike,
    notifyCommentReply: preferences.notifyCommentReply,
    notifyNewComment: preferences.notifyNewComment,
    notifyClubInvitation: preferences.notifyClubInvitation,
    notifyClubMembership: preferences.notifyClubMembership,
    notifyClubActivity: preferences.notifyClubActivity,
    notifyClubAnnouncement: preferences.notifyClubAnnouncement,
  };
}

function assignDefined(
  preferences: UserPreferenceEntity,
  patch: Partial<PreferenceView>,
): void {
  const keys = Object.keys(patch) as (keyof PreferenceView)[];
  for (const key of keys) {
    const value = patch[key];
    if (value !== undefined) {
      preferences[key] = value;
    }
  }
}

export function mapIdentityConflict(error: unknown): Error {
  if (postgresErrorCode(error) !== '23505') {
    return error instanceof Error ? error : new Error('Write failed');
  }
  const constraint = postgresConstraint(error) ?? '';
  if (constraint.includes('email')) {
    return new DomainError(
      'CONFLICT',
      'users.email_taken',
      'An account with this email already exists',
    );
  }
  if (constraint.includes('username')) {
    return new DomainError(
      'CONFLICT',
      'users.username_taken',
      'This username is already taken',
    );
  }
  return new DomainError(
    'CONFLICT',
    'users.conflict',
    'That value is already used',
  );
}

export function newId(): string {
  return randomUUID();
}
