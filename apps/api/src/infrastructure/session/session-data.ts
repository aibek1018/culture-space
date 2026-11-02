import 'express-session';

/**
 * Server-side session payload. Role, status, and verification are loaded
 * from PostgreSQL on every request and are intentionally absent here.
 */
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    issuedAt?: number;
  }
}
