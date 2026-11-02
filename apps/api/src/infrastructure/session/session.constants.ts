/** Cookie name from the approved session design (D-19). */
export const SESSION_COOKIE_NAME = 'cs.sid';

/** Prefix for connect-redis keys. The per-user set is added in Milestone 2. */
export const SESSION_KEY_PREFIX = 'cs:sess:';

/**
 * Idle lifetime, refreshed when the session is used.
 * The 30-day absolute lifetime is enforced by the auth module in Milestone 2.
 */
export const SESSION_IDLE_TTL_SECONDS = 14 * 24 * 60 * 60;
