import type { INestApplication } from '@nestjs/common';
import { OutboxRuntime } from '../src/infrastructure/outbox/outbox.runtime';
import {
  createTestApp,
  errorCode,
  graphqlAgent,
  resetState,
  ScriptedMailer,
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

describe('GraphQL end-to-end journeys', () => {
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
      { token: readerToken },
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
