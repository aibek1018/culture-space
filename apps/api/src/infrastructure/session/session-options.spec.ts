import session from 'express-session';
import {
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_SECONDS,
} from './session.constants';
import { createSessionOptions } from './session-options';

describe('createSessionOptions', () => {
  const store = new session.MemoryStore();

  it('uses an HttpOnly Lax cookie and leaves Secure off outside production', () => {
    const options = createSessionOptions(
      {
        nodeEnv: 'development',
        sessionSecret: 'test-session-secret-with-enough-length',
      },
      store,
    );

    expect(options.name).toBe(SESSION_COOKIE_NAME);
    expect(options.resave).toBe(false);
    expect(options.saveUninitialized).toBe(false);
    expect(options.rolling).toBe(true);
    expect(options.cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
      path: '/',
      maxAge: SESSION_IDLE_TTL_SECONDS * 1000,
    });
  });

  it('marks the cookie Secure in production', () => {
    const options = createSessionOptions(
      {
        nodeEnv: 'production',
        sessionSecret: 'production-session-secret-value-32',
      },
      store,
    );

    const cookie = options.cookie;
    if (cookie === undefined || typeof cookie === 'function') {
      throw new Error('Expected a static session cookie');
    }
    expect(cookie.secure).toBe(true);
  });
});
