import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import { postgresErrorCode } from '../../common/errors/database-error';
import { decodeCursor, encodeCursor } from '../../common/graphql/cursor';
import { normalizePageSize } from '../../common/graphql/page-info.type';
import type { CurrentAccount } from '../../common/auth/current-account';
import { FollowEntity } from './entities/follow.entity';
import { detachFollowerNotification } from './follow-notification.contract';
import {
  canViewFollowLists,
  toPublicProfile,
  type PublicProfile,
} from './privacy';
import { ProfileService, newId } from './profile.service';
import { UserRepository } from './user.repository';

export interface ProfileConnection {
  nodes: PublicProfile[];
  pageInfo: { endCursor: string | null; hasNextPage: boolean };
}

@Injectable()
export class FollowService {
  constructor(
    private readonly users: UserRepository,
    private readonly profiles: ProfileService,
  ) {}

  async followers(
    username: string,
    viewer: CurrentAccount | null,
    cursor: string | null,
    pageSize: number | null,
  ): Promise<ProfileConnection> {
    return this.list(username, viewer, cursor, pageSize, 'followers');
  }

  async following(
    username: string,
    viewer: CurrentAccount | null,
    cursor: string | null,
    pageSize: number | null,
  ): Promise<ProfileConnection> {
    return this.list(username, viewer, cursor, pageSize, 'following');
  }

  async follow(
    actor: CurrentAccount,
    username: string,
  ): Promise<PublicProfile> {
    this.assertCanPost(actor);
    const target = await this.profiles.requireByUsername(username);
    if (target.id === actor.id) {
      throw new DomainError(
        'VALIDATION',
        'users.self_follow',
        'You cannot follow yourself',
      );
    }
    const manager = await this.users.manager();
    const existing = await manager.getRepository(FollowEntity).findOne({
      where: { followerId: actor.id, followingId: target.id },
    });
    if (!existing) {
      try {
        await manager.getRepository(FollowEntity).insert({
          id: newId(),
          followerId: actor.id,
          followingId: target.id,
          createdAt: new Date(),
        });
      } catch (error) {
        if (postgresErrorCode(error) !== '23505') {
          throw error;
        }
      }
    }
    return this.profiles.getPublicProfile(target.username, actor.id);
  }

  async unfollow(
    actor: CurrentAccount,
    username: string,
  ): Promise<PublicProfile> {
    this.assertCanPost(actor);
    const target = await this.profiles.requireByUsername(username);
    const manager = await this.users.manager();
    await manager.transaction(async (transaction) => {
      const follow = await transaction.getRepository(FollowEntity).findOne({
        where: { followerId: actor.id, followingId: target.id },
      });
      if (!follow) {
        return;
      }
      await detachFollowerNotification(transaction, follow.id, target.id);
      await transaction.getRepository(FollowEntity).delete({ id: follow.id });
    });
    return this.profiles.getPublicProfile(target.username, actor.id);
  }

  private assertCanPost(actor: CurrentAccount): void {
    if (actor.postingSuspended) {
      throw new DomainError(
        'FORBIDDEN',
        'users.posting_restricted',
        'This account cannot follow users right now',
      );
    }
  }

  private async list(
    username: string,
    viewer: CurrentAccount | null,
    cursor: string | null,
    pageSize: number | null,
    direction: 'followers' | 'following',
  ): Promise<ProfileConnection> {
    const owner = await this.profiles.requireByUsername(username);
    if (
      !canViewFollowLists(owner.profileVisibility, viewer?.id ?? null, owner.id)
    ) {
      throw new DomainError('NOT_FOUND', 'users.not_found', 'User not found');
    }
    const size = normalizePageSize(pageSize);
    const decoded =
      cursor === null || cursor === undefined ? null : decodeCursor(cursor);
    const params: unknown[] = [owner.id];
    let cursorSql = '';
    if (decoded) {
      params.push(decoded.createdAt, decoded.id);
      cursorSql = `AND (f.created_at, f.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
    }
    params.push(size + 1);
    const userJoin =
      direction === 'followers' ? 'f.follower_id' : 'f.following_id';
    const ownerColumn =
      direction === 'followers' ? 'f.following_id' : 'f.follower_id';
    const manager = await this.users.manager();
    const rows: unknown = await manager.query(
      `SELECT u.id, u.username, u.full_name, u.avatar_url, u.bio, u.country_code,
              u.created_at, u.profile_visibility, f.created_at AS followed_at, f.id AS follow_id
       FROM follows f
       JOIN users u ON u.id = ${userJoin}
       WHERE ${ownerColumn} = $1
       ${cursorSql}
       ORDER BY f.created_at DESC, f.id DESC
       LIMIT $${params.length}`,
      params,
    );
    const parsed = parseFollowRows(rows);
    const hasNextPage = parsed.length > size;
    const page = hasNextPage ? parsed.slice(0, size) : parsed;
    const last = page[page.length - 1];
    const followedByViewer = await this.followedSet(
      viewer?.id ?? null,
      page.map((row) => row.id),
    );
    const countMap = await this.countMap(page.map((row) => row.id));
    return {
      nodes: page.map((row) =>
        toPublicProfile(
          {
            id: row.id,
            username: row.username,
            fullName: row.fullName,
            avatarUrl: row.avatarUrl,
            bio: row.bio,
            countryCode: row.countryCode,
            createdAt: row.createdAt,
            profileVisibility: row.profileVisibility,
          },
          countMap.get(row.id) ?? { followers: 0, following: 0 },
          followedByViewer.has(row.id),
        ),
      ),
      pageInfo: {
        hasNextPage,
        endCursor: last ? encodeCursor(last.followedAt, last.followId) : null,
      },
    };
  }

  private async followedSet(
    viewerId: string | null,
    userIds: string[],
  ): Promise<Set<string>> {
    if (viewerId === null || userIds.length === 0) {
      return new Set();
    }
    const manager = await this.users.manager();
    const rows: unknown = await manager.query(
      `SELECT following_id FROM follows WHERE follower_id = $1 AND following_id = ANY($2::uuid[])`,
      [viewerId, userIds],
    );
    const ids = new Set<string>();
    if (!Array.isArray(rows)) {
      return ids;
    }
    for (const row of rows) {
      if (typeof row === 'object' && row !== null) {
        const id = Reflect.get(row, 'following_id');
        if (typeof id === 'string') {
          ids.add(id);
        }
      }
    }
    return ids;
  }

  private async countMap(
    userIds: string[],
  ): Promise<Map<string, { followers: number; following: number }>> {
    const map = new Map<string, { followers: number; following: number }>();
    for (const id of userIds) {
      map.set(id, { followers: 0, following: 0 });
    }
    if (userIds.length === 0) {
      return map;
    }
    const manager = await this.users.manager();
    const followers: unknown = await manager.query(
      `SELECT following_id AS user_id, count(*)::int AS total
       FROM follows WHERE following_id = ANY($1::uuid[]) GROUP BY following_id`,
      [userIds],
    );
    const following: unknown = await manager.query(
      `SELECT follower_id AS user_id, count(*)::int AS total
       FROM follows WHERE follower_id = ANY($1::uuid[]) GROUP BY follower_id`,
      [userIds],
    );
    applyCounts(map, followers, 'followers');
    applyCounts(map, following, 'following');
    return map;
  }
}

interface FollowRow {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  countryCode: string | null;
  createdAt: Date;
  profileVisibility: 'PUBLIC' | 'PRIVATE';
  followedAt: Date;
  followId: string;
}

function parseFollowRows(value: unknown): FollowRow[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const rows: FollowRow[] = [];
  for (const candidate of value) {
    if (typeof candidate !== 'object' || candidate === null) {
      continue;
    }
    const id = Reflect.get(candidate, 'id');
    const username = Reflect.get(candidate, 'username');
    const fullName = Reflect.get(candidate, 'full_name');
    const visibility = Reflect.get(candidate, 'profile_visibility');
    const followedAt = Reflect.get(candidate, 'followed_at');
    const followId = Reflect.get(candidate, 'follow_id');
    const createdAt = Reflect.get(candidate, 'created_at');
    if (
      typeof id !== 'string' ||
      typeof username !== 'string' ||
      typeof fullName !== 'string' ||
      (visibility !== 'PUBLIC' && visibility !== 'PRIVATE') ||
      typeof followId !== 'string'
    ) {
      continue;
    }
    rows.push({
      id,
      username,
      fullName,
      avatarUrl: stringOrNull(Reflect.get(candidate, 'avatar_url')),
      bio: stringOrNull(Reflect.get(candidate, 'bio')),
      countryCode:
        stringOrNull(Reflect.get(candidate, 'country_code'))?.trim() || null,
      createdAt: toDate(createdAt),
      profileVisibility: visibility,
      followedAt: toDate(followedAt),
      followId,
    });
  }
  return rows;
}

function applyCounts(
  map: Map<string, { followers: number; following: number }>,
  rows: unknown,
  field: 'followers' | 'following',
): void {
  if (!Array.isArray(rows)) {
    return;
  }
  for (const row of rows) {
    if (typeof row !== 'object' || row === null) {
      continue;
    }
    const userId = Reflect.get(row, 'user_id');
    const total = Reflect.get(row, 'total');
    if (typeof userId !== 'string') {
      continue;
    }
    const current = map.get(userId) ?? { followers: 0, following: 0 };
    current[field] = typeof total === 'number' ? total : Number(total) || 0;
    map.set(userId, current);
  }
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

function toDate(value: unknown): Date {
  if (value instanceof Date) {
    return value;
  }
  if (typeof value === 'string') {
    return new Date(value);
  }
  return new Date(0);
}
