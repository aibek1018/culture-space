/** Cookie name from the approved session design (D-19). */
export const SESSION_COOKIE_NAME = 'cs.sid';

/** Prefix for connect-redis keys. Tests may isolate this with SESSION_KEY_PREFIX. */
export const SESSION_KEY_PREFIX = process.env.SESSION_KEY_PREFIX ?? 'cs:sess:';

/** Redis set of session ids for one user. Logout-all and password reset read it. */
export const USER_SESSIONS_PREFIX =
  process.env.USER_SESSIONS_PREFIX ?? 'user-sessions:';

/**
 * Idle lifetime, refreshed when the session is used (`rolling: true`).
 */
export const SESSION_IDLE_TTL_SECONDS = 14 * 24 * 60 * 60;

/** Absolute lifetime, measured from `issuedAt` and not extended by activity. */
export const SESSION_ABSOLUTE_TTL_SECONDS = 30 * 24 * 60 * 60;
