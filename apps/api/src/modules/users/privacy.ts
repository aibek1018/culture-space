export type ProfileVisibility = 'PUBLIC' | 'PRIVATE';
export type LibraryVisibility = 'PUBLIC' | 'PRIVATE';

export interface PublicProfileSource {
  id: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  countryCode: string | null;
  createdAt: Date;
  profileVisibility: ProfileVisibility;
}

export interface PublicProfile extends PublicProfileSource {
  followersCount: number;
  followingCount: number;
  isFollowedByViewer: boolean;
}

/**
 * Public profile shell. Email, password hash, preferences, and account status
 * are not part of this object.
 */
export function toPublicProfile(
  user: PublicProfileSource,
  counts: { followers: number; following: number },
  isFollowedByViewer: boolean,
): PublicProfile {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    avatarUrl: user.avatarUrl,
    bio: user.bio,
    countryCode: user.countryCode,
    createdAt: user.createdAt,
    profileVisibility: user.profileVisibility,
    followersCount: counts.followers,
    followingCount: counts.following,
    isFollowedByViewer,
  };
}

export function canViewFollowLists(
  profileVisibility: ProfileVisibility,
  viewerId: string | null,
  ownerId: string,
): boolean {
  if (profileVisibility === 'PUBLIC') {
    return true;
  }
  return viewerId === ownerId;
}

/**
 * Making a profile private also makes the library private.
 * A later public profile may keep a private library.
 */
export function applyPrivacyUpdate(input: {
  profileVisibility: ProfileVisibility;
  libraryVisibility: LibraryVisibility;
}): {
  profileVisibility: ProfileVisibility;
  libraryVisibility: LibraryVisibility;
} {
  if (input.profileVisibility === 'PRIVATE') {
    return { profileVisibility: 'PRIVATE', libraryVisibility: 'PRIVATE' };
  }
  return {
    profileVisibility: input.profileVisibility,
    libraryVisibility: input.libraryVisibility,
  };
}
