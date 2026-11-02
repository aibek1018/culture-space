import { createHash, randomBytes } from 'node:crypto';

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
export const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

export function createRawToken(): string {
  return randomBytes(32).toString('base64url');
}

/** SHA-256 hex of the raw token. Only this value is stored. */
export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}
