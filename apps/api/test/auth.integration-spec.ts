import type { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { OutboxRuntime } from '../src/infrastructure/outbox/outbox.runtime';
import { RedisService } from '../src/infrastructure/redis/redis.service';
import { SESSION_KEY_PREFIX } from '../src/infrastructure/session/session.constants';
import {
  createTestApp,
  errorCode,
  graphqlAgent,
  resetState,
  ScriptedMailer,
  sessionIdFromResponse,
  settleOutbox,
  tokenFromMessage,
} from './harness';

const registerMutation = `
  mutation Register($input: RegisterInput!) {
    register(input: $input) {
      id
      username
      email
      role
      emailVerifiedAt
    }
  }
`;

const loginMutation = `
  mutation Login($input: LoginInput!) {
    login(input: $input) { id email role emailVerifiedAt }
  }
`;

function registerInput(overrides: Record<string, string> = {}) {
  return {
    username: 'reader_one',
    fullName: 'Reader One',
    email: 'reader@example.com',
    password: 'correct-horse',
    preferredLanguage: 'EN',
    ...overrides,
  };
}

describe('authentication, profiles, and follows', () => {
  let app: INestApplication;
  const mailer = new ScriptedMailer();

  beforeAll(async () => {
    app = await createTestApp(mailer);
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await app.get(OutboxRuntime).pause();
    await resetState(app);
    mailer.reset();
    await app.get(OutboxRuntime).resume();
  });

  it('rejects duplicate emails and usernames without regard to case', async () => {
    const created = await graphqlAgent(app).send(registerMutation, {
      input: registerInput({
        email: 'Reader@Example.com',
        username: 'Reader_One',
      }),
    });
    expect(created.body.data.register.email).toBe('reader@example.com');
    expect(created.body.data.register.username).toBe('Reader_One');

    const duplicateEmail = await graphqlAgent(app).send(registerMutation, {
      input: registerInput({
        email: 'reader@example.com',
        username: 'another_name',
      }),
    });
    expect(errorCode(duplicateEmail.body)).toBe('CONFLICT');
    expect(duplicateEmail.body.errors[0].extensions.i18nKey).toBe(
      'users.email_taken',
    );

    const duplicateUsername = await graphqlAgent(app).send(registerMutation, {
      input: registerInput({
        email: 'other@example.com',
        username: 'reader_one',
      }),
    });
    expect(errorCode(duplicateUsername.body)).toBe('CONFLICT');
    expect(duplicateUsername.body.errors[0].extensions.i18nKey).toBe(
      'users.username_taken',
    );
  });

  it('does not reveal whether an email exists when the password is wrong', async () => {
    await graphqlAgent(app).send(registerMutation, { input: registerInput() });
    const unknown = await graphqlAgent(app).send(loginMutation, {
      input: { email: 'missing@example.com', password: 'correct-horse' },
    });
    const wrong = await graphqlAgent(app).send(loginMutation, {
      input: { email: 'reader@example.com', password: 'wrong-password' },
    });
    expect(errorCode(unknown.body)).toBe('UNAUTHENTICATED');
    expect(errorCode(wrong.body)).toBe('UNAUTHENTICATED');
    expect(unknown.body.errors[0].message).toBe(wrong.body.errors[0].message);
  });

  it('registers, verifies, expires, and consumes a token once', async () => {
    const agent = graphqlAgent(app);
    const created = await agent.send(registerMutation, {
      input: registerInput(),
    });
    expect(created.body.data.register.emailVerifiedAt).toBeNull();
    await settleOutbox(app);
    expect(mailer.sent).toHaveLength(1);
    const token = tokenFromMessage(mailer.sent[0]?.text ?? '');
    const dataSource = app.get(DataSource);
    const before = await dataSource.query(
      'SELECT count(*)::int AS count FROM email_verification_tokens',
    );
    expect(Number(before[0].count)).toBe(1);

    await dataSource.query(
      `UPDATE email_verification_tokens SET expires_at = now() - interval '1 minute'`,
    );
    const expired = await agent.send(
      `mutation($token: String!) { verifyEmail(token: $token) { id } }`,
      { token },
    );
    expect(errorCode(expired.body)).toBe('VALIDATION');

    await dataSource.query(
      `UPDATE email_verification_tokens SET expires_at = now() + interval '1 hour'`,
    );
    const verified = await agent.send(
      `mutation($token: String!) { verifyEmail(token: $token) { emailVerifiedAt } }`,
      { token },
    );
    expect(verified.body.data.verifyEmail.emailVerifiedAt).toEqual(
      expect.any(String),
    );
    const again = await agent.send(
      `mutation($token: String!) { verifyEmail(token: $token) { id } }`,
      { token },
    );
    expect(errorCode(again.body)).toBe('VALIDATION');
    const after = await dataSource.query(
      'SELECT count(*)::int AS count FROM email_verification_tokens',
    );
    expect(Number(after[0].count)).toBe(1);
  });

  it('regenerates the session on login and drops it when it expires', async () => {
    const agent = graphqlAgent(app);
    const first = await agent.send(registerMutation, {
      input: registerInput(),
    });
    const firstId = sessionIdFromResponse(first);
    const second = await agent.send(loginMutation, {
      input: { email: 'reader@example.com', password: 'correct-horse' },
    });
    const secondId = sessionIdFromResponse(second);
    expect(secondId).not.toBe(firstId);

    const redis = app.get(RedisService);
    const stored = await redis.client.get(`${SESSION_KEY_PREFIX}${secondId}`);
    const session = JSON.parse(stored ?? '{}') as {
      userId?: string;
      role?: string;
      issuedAt?: number;
    };
    expect(session.userId).toBe(first.body.data.register.id);
    expect(session.role).toBeUndefined();
    session.issuedAt = Date.now() - 31 * 24 * 60 * 60 * 1000;
    await redis.client.set(
      `${SESSION_KEY_PREFIX}${secondId}`,
      JSON.stringify(session),
      {
        KEEPTTL: true,
      },
    );
    expect(
      (await agent.send(`query { me { id email } }`)).body.data.me,
    ).toBeNull();

    const fresh = graphqlAgent(app);
    const loggedIn = await fresh.send(loginMutation, {
      input: { email: 'reader@example.com', password: 'correct-horse' },
    });
    const freshId = sessionIdFromResponse(loggedIn);
    await redis.client.del(`${SESSION_KEY_PREFIX}${freshId}`);
    expect((await fresh.send(`query { me { id } }`)).body.data.me).toBeNull();
  });

  it('logs out the current session and every session', async () => {
    const first = graphqlAgent(app);
    const second = graphqlAgent(app);
    await first.send(registerMutation, { input: registerInput() });
    await second.send(loginMutation, {
      input: { email: 'reader@example.com', password: 'correct-horse' },
    });
    await first.send(`mutation { logout }`);
    expect((await first.send(`query { me { id } }`)).body.data.me).toBeNull();
    expect(
      (await second.send(`query { me { id } }`)).body.data.me,
    ).not.toBeNull();
    await second.send(`mutation { logoutAll }`);
    expect((await second.send(`query { me { id } }`)).body.data.me).toBeNull();
  });

  it('keeps the current session when the password changes', async () => {
    const current = graphqlAgent(app);
    const other = graphqlAgent(app);
    await current.send(registerMutation, { input: registerInput() });
    await other.send(loginMutation, {
      input: { email: 'reader@example.com', password: 'correct-horse' },
    });
    const changed = await current.send(
      `mutation($input: ChangePasswordInput!) { changePassword(input: $input) }`,
      {
        input: {
          currentPassword: 'correct-horse',
          newPassword: 'new-password-1',
        },
      },
    );
    expect(changed.body.data.changePassword).toBe(true);
    expect(
      (await current.send(`query { me { id } }`)).body.data.me,
    ).not.toBeNull();
    expect((await other.send(`query { me { id } }`)).body.data.me).toBeNull();
  });

  it('resets a password once and clears sessions from the outbox', async () => {
    const first = graphqlAgent(app);
    const second = graphqlAgent(app);
    await first.send(registerMutation, { input: registerInput() });
    await settleOutbox(app);
    await second.send(loginMutation, {
      input: { email: 'reader@example.com', password: 'correct-horse' },
    });
    mailer.sent = [];
    const hidden = await graphqlAgent(app).send(
      `mutation($email: String!) { requestPasswordReset(email: $email) }`,
      { email: 'nobody@example.com' },
    );
    expect(hidden.body.data.requestPasswordReset).toBe(true);
    await settleOutbox(app);
    expect(mailer.sent).toHaveLength(0);

    await graphqlAgent(app).send(
      `mutation($email: String!) { requestPasswordReset(email: $email) }`,
      { email: 'reader@example.com' },
    );
    await settleOutbox(app);
    const token = tokenFromMessage(mailer.sent[0]?.text ?? '');
    const dataSource = app.get(DataSource);
    const reset = await graphqlAgent(app).send(
      `mutation($input: ResetPasswordInput!) { resetPassword(input: $input) }`,
      { input: { token, newPassword: 'reset-password-1' } },
    );
    expect(reset.body.data.resetPassword).toBe(true);
    await settleOutbox(app);
    expect((await first.send(`query { me { id } }`)).body.data.me).toBeNull();
    expect((await second.send(`query { me { id } }`)).body.data.me).toBeNull();
    const reused = await graphqlAgent(app).send(
      `mutation($input: ResetPasswordInput!) { resetPassword(input: $input) }`,
      { input: { token, newPassword: 'reset-password-2' } },
    );
    expect(errorCode(reused.body)).toBe('VALIDATION');
    const tokens = await dataSource.query(
      'SELECT count(*)::int AS count FROM password_reset_tokens',
    );
    expect(Number(tokens[0].count)).toBe(1);
  });

  it('applies a role change on the next request', async () => {
    const agent = graphqlAgent(app);
    const created = await agent.send(registerMutation, {
      input: registerInput(),
    });
    await settleOutbox(app);
    const token = tokenFromMessage(mailer.sent[0]?.text ?? '');
    await agent.send(
      `mutation($token: String!) { verifyEmail(token: $token) { id } }`,
      {
        token,
      },
    );
    expect(
      errorCode(
        (await agent.send(`query { failedOutboxMessages { id } }`)).body,
      ),
    ).toBe('FORBIDDEN');
    const dataSource = app.get(DataSource);
    await dataSource.query(`UPDATE users SET role = 'ADMIN' WHERE id = $1`, [
      created.body.data.register.id,
    ]);
    const allowed = await agent.send(`query { failedOutboxMessages { id } }`);
    expect(allowed.body.data.failedOutboxMessages).toEqual([]);
    await dataSource.query(`UPDATE users SET role = 'USER' WHERE id = $1`, [
      created.body.data.register.id,
    ]);
    expect(
      errorCode(
        (await agent.send(`query { failedOutboxMessages { id } }`)).body,
      ),
    ).toBe('FORBIDDEN');
  });

  it('blocks unverified follows, self-follows, and duplicate follows', async () => {
    const reader = graphqlAgent(app);
    await reader.send(registerMutation, { input: registerInput() });
    const author = graphqlAgent(app);
    await author.send(registerMutation, {
      input: registerInput({
        username: 'author_one',
        email: 'author@example.com',
        fullName: 'Author One',
      }),
    });
    await settleOutbox(app);
    expect(
      errorCode(
        (
          await reader.send(
            `mutation { followUser(username: "author_one") { username } }`,
          )
        ).body,
      ),
    ).toBe('EMAIL_NOT_VERIFIED');

    const readerToken = tokenFromMessage(
      mailer.sent.find((message) => message.to === 'reader@example.com')
        ?.text ?? '',
    );
    const authorToken = tokenFromMessage(
      mailer.sent.find((message) => message.to === 'author@example.com')
        ?.text ?? '',
    );
    await reader.send(
      `mutation($token: String!) { verifyEmail(token: $token) { id } }`,
      {
        token: readerToken,
      },
    );
    await author.send(
      `mutation($token: String!) { verifyEmail(token: $token) { id } }`,
      {
        token: authorToken,
      },
    );
    expect(
      errorCode(
        (
          await reader.send(
            `mutation { followUser(username: "Reader_One") { username } }`,
          )
        ).body,
      ),
    ).toBe('VALIDATION');
    const followed = await reader.send(
      `mutation { followUser(username: "author_one") { username isFollowedByViewer followersCount } }`,
    );
    expect(followed.body.data.followUser.followersCount).toBe(1);
    await reader.send(
      `mutation { followUser(username: "author_one") { username } }`,
    );
    const dataSource = app.get(DataSource);
    expect(
      Number(
        (
          await dataSource.query('SELECT count(*)::int AS count FROM follows')
        )[0].count,
      ),
    ).toBe(1);
    const unfollowed = await reader.send(
      `mutation { unfollowUser(username: "author_one") { isFollowedByViewer } }`,
    );
    expect(unfollowed.body.data.unfollowUser.isFollowedByViewer).toBe(false);
    await reader.send(
      `mutation { unfollowUser(username: "author_one") { username } }`,
    );
    expect(
      Number(
        (
          await dataSource.query('SELECT count(*)::int AS count FROM follows')
        )[0].count,
      ),
    ).toBe(0);
  });

  it('hides private follower lists and password hashes', async () => {
    const owner = graphqlAgent(app);
    const created = await owner.send(registerMutation, {
      input: registerInput(),
    });
    const privacy = await owner.send(
      `mutation($input: UpdatePrivacyInput!) {
        updatePrivacy(input: $input) { profileVisibility libraryVisibility }
      }`,
      { input: { profileVisibility: 'PRIVATE', libraryVisibility: 'PUBLIC' } },
    );
    expect(privacy.body.data.updatePrivacy).toEqual({
      profileVisibility: 'PRIVATE',
      libraryVisibility: 'PRIVATE',
    });
    const profile = await graphqlAgent(app).send(
      `query { userProfile(username: "reader_one") { username } }`,
    );
    expect(profile.body.data.userProfile.username).toBe('reader_one');
    expect(JSON.stringify(profile.body)).not.toContain('reader@example.com');
    expect(JSON.stringify(created.body)).not.toContain('$argon2');
    expect(JSON.stringify(created.body)).not.toContain('passwordHash');
    expect(
      errorCode(
        (
          await graphqlAgent(app).send(
            `query { followers(username: "reader_one") { nodes { username } } }`,
          )
        ).body,
      ),
    ).toBe('NOT_FOUND');
  });

  it('rejects a self-follow row and rolls back a failed outbox insert', async () => {
    const dataSource = app.get(DataSource);
    const created = await graphqlAgent(app).send(registerMutation, {
      input: registerInput(),
    });
    const id = created.body.data.register.id;
    await expect(
      dataSource.query(
        `INSERT INTO follows (follower_id, following_id, created_at) VALUES ($1, $1, now())`,
        [id],
      ),
    ).rejects.toThrow(/follows_not_self_check/);

    await dataSource.query('DELETE FROM users WHERE id = $1', [id]);
    await dataSource.query(`
      CREATE OR REPLACE FUNCTION m2_outbox_fail() RETURNS trigger AS $$
      BEGIN
        RAISE EXCEPTION 'forced outbox failure';
      END;
      $$ LANGUAGE plpgsql
    `);
    await dataSource.query(`
      CREATE TRIGGER m2_outbox_fail
      BEFORE INSERT ON outbox_messages
      FOR EACH ROW EXECUTE FUNCTION m2_outbox_fail()
    `);
    try {
      const response = await graphqlAgent(app).send(registerMutation, {
        input: registerInput({
          email: 'atomic@example.com',
          username: 'atomic_user',
        }),
      });
      expect(response.body.data).toBeNull();
      const users = await dataSource.query(
        `SELECT count(*)::int AS count FROM users WHERE email = 'atomic@example.com'`,
      );
      expect(Number(users[0].count)).toBe(0);
    } finally {
      await dataSource.query(
        'DROP TRIGGER IF EXISTS m2_outbox_fail ON outbox_messages',
      );
      await dataSource.query('DROP FUNCTION IF EXISTS m2_outbox_fail()');
    }
  });

  it('detaches a historical follower notification and then deletes the follow', async () => {
    const reader = graphqlAgent(app);
    const author = graphqlAgent(app);
    await reader.send(registerMutation, { input: registerInput() });
    await author.send(registerMutation, {
      input: registerInput({
        username: 'author_one',
        email: 'author@example.com',
        fullName: 'Author One',
      }),
    });
    await settleOutbox(app);
    for (const message of mailer.sent) {
      await graphqlAgent(app).send(
        `mutation($token: String!) { verifyEmail(token: $token) { id } }`,
        { token: tokenFromMessage(message.text) },
      );
    }
    await reader.send(`mutation { followUser(username: "author_one") { id } }`);
    const dataSource = app.get(DataSource);
    const follow = (
      await dataSource.query(
        `SELECT id, following_id, follower_id FROM follows`,
      )
    )[0];
    await dataSource.query(`
      CREATE TABLE notifications (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        recipient_id uuid NOT NULL,
        actor_id uuid NOT NULL,
        type varchar(40) NOT NULL,
        subject_detached boolean NOT NULL DEFAULT false,
        subject_snapshot jsonb NOT NULL,
        follow_id uuid REFERENCES follows (id) ON DELETE RESTRICT,
        dedupe_key varchar(200) NOT NULL UNIQUE,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    await dataSource.query(
      `INSERT INTO notifications (recipient_id, actor_id, type, subject_snapshot, follow_id, dedupe_key)
       VALUES ($1, $2, 'NEW_FOLLOWER', '{"username":"Reader_One"}'::jsonb, $3, $4)`,
      [
        follow.following_id,
        follow.follower_id,
        follow.id,
        `NEW_FOLLOWER:${follow.following_id}:${follow.id}`,
      ],
    );
    const removed = await reader.send(
      `mutation { unfollowUser(username: "author_one") { username } }`,
    );
    expect(removed.body.data.unfollowUser.username).toBe('author_one');
    const notification = (
      await dataSource.query(
        `SELECT subject_detached, follow_id, subject_snapshot FROM notifications`,
      )
    )[0];
    expect(notification.subject_detached).toBe(true);
    expect(notification.follow_id).toBeNull();
    expect(notification.subject_snapshot).toEqual({ username: 'Reader_One' });
    expect(
      Number(
        (
          await dataSource.query('SELECT count(*)::int AS count FROM follows')
        )[0].count,
      ),
    ).toBe(0);
  });

  it('runs the register, verify, login, and follow journey', async () => {
    const reader = graphqlAgent(app);
    await reader.send(registerMutation, { input: registerInput() });
    await graphqlAgent(app).send(registerMutation, {
      input: registerInput({
        username: 'author_one',
        email: 'author@example.com',
        fullName: 'Author One',
      }),
    });
    await settleOutbox(app);
    const readerToken = tokenFromMessage(
      mailer.sent.find((message) => message.to === 'reader@example.com')
        ?.text ?? '',
    );
    await reader.send(
      `mutation($token: String!) { verifyEmail(token: $token) { id } }`,
      {
        token: readerToken,
      },
    );
    const fresh = graphqlAgent(app);
    const loggedIn = await fresh.send(loginMutation, {
      input: { email: 'reader@example.com', password: 'correct-horse' },
    });
    expect(loggedIn.body.data.login.emailVerifiedAt).toEqual(
      expect.any(String),
    );
    const followed = await fresh.send(
      `mutation { followUser(username: "author_one") { username isFollowedByViewer } }`,
    );
    expect(followed.body.data.followUser).toEqual({
      username: 'author_one',
      isFollowedByViewer: true,
    });
    const emptyFavorites = await fresh.send(
      `mutation { setFavoriteGenres(genreIds: []) { id } }`,
    );
    expect(emptyFavorites.body.data.setFavoriteGenres).toEqual([]);
    const unavailable = await fresh.send(
      `mutation { setFavoriteGenres(genreIds: ["11111111-1111-4111-8111-111111111111"]) { id } }`,
    );
    expect(errorCode(unavailable.body)).toBe('NOT_FOUND');
    expect(unavailable.body.errors[0].extensions.i18nKey).toBe(
      'favorites.catalog_unavailable',
    );
  });
});
