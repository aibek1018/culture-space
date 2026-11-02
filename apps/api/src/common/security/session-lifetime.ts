import { SESSION_ABSOLUTE_TTL_SECONDS } from '../../infrastructure/session/session.constants';

/**
 * A session without `issuedAt` is incomplete and is treated as expired.
 * Activity does not extend the 30-day absolute lifetime.
 */
export function isAbsoluteSessionExpired(
  issuedAt: number | undefined,
  now: number,
): boolean {
  if (issuedAt === undefined || !Number.isFinite(issuedAt)) {
    return true;
  }
  return now - issuedAt > SESSION_ABSOLUTE_TTL_SECONDS * 1000;
}
