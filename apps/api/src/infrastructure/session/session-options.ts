import type { SessionOptions, Store } from 'express-session';
import type { AppConfig } from '../../config/env.schema';
import {
  SESSION_COOKIE_NAME,
  SESSION_IDLE_TTL_SECONDS,
} from './session.constants';

export function createSessionOptions(
  config: Pick<AppConfig, 'nodeEnv' | 'sessionSecret'>,
  store: Store,
): SessionOptions {
  return {
    store,
    name: SESSION_COOKIE_NAME,
    secret: config.sessionSecret,
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: config.nodeEnv === 'production',
      path: '/',
      maxAge: SESSION_IDLE_TTL_SECONDS * 1000,
    },
  };
}
