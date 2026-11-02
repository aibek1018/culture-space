import 'express-session';

/**
 * Payload reserved for Milestone 2.
 * Login is not implemented, and these fields are not written yet.
 */
declare module 'express-session' {
  interface SessionData {
    userId?: string;
    issuedAt?: number;
  }
}
