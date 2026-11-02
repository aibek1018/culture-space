import { applyPrivacyUpdate, toPublicProfile } from './privacy';

describe('profile privacy', () => {
  const source = {
    id: '4f0b6e2a-6e2a-4b2a-8e2a-6e2a4b2a8e2a',
    username: 'Reader',
    fullName: 'Reader Name',
    avatarUrl: null,
    bio: 'Hello',
    countryCode: 'KZ',
    createdAt: new Date('2026-11-02T00:00:00.000Z'),
    profileVisibility: 'PUBLIC' as const,
  };

  it('omits email and password material from the public profile', () => {
    const profile = toPublicProfile(
      source,
      { followers: 2, following: 3 },
      false,
    );
    expect(profile).toEqual({
      ...source,
      followersCount: 2,
      followingCount: 3,
      isFollowedByViewer: false,
    });
    expect(JSON.stringify(profile)).not.toContain('email');
    expect(JSON.stringify(profile)).not.toContain('password');
  });

  it('forces a private library when the profile becomes private', () => {
    expect(
      applyPrivacyUpdate({
        profileVisibility: 'PRIVATE',
        libraryVisibility: 'PUBLIC',
      }),
    ).toEqual({ profileVisibility: 'PRIVATE', libraryVisibility: 'PRIVATE' });
    expect(
      applyPrivacyUpdate({
        profileVisibility: 'PUBLIC',
        libraryVisibility: 'PRIVATE',
      }),
    ).toEqual({ profileVisibility: 'PUBLIC', libraryVisibility: 'PRIVATE' });
  });
});
