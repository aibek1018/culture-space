import { isAbsoluteSessionExpired } from './session-lifetime';
import { SESSION_ABSOLUTE_TTL_SECONDS } from '../../infrastructure/session/session.constants';

describe('absolute session lifetime', () => {
  const now = Date.UTC(2026, 10, 2);

  it('expires a session after 30 days and a session without issuedAt', () => {
    expect(isAbsoluteSessionExpired(undefined, now)).toBe(true);
    expect(
      isAbsoluteSessionExpired(
        now - SESSION_ABSOLUTE_TTL_SECONDS * 1000 - 1,
        now,
      ),
    ).toBe(true);
  });

  it('keeps a session inside the absolute lifetime', () => {
    expect(isAbsoluteSessionExpired(now - 1000, now)).toBe(false);
  });
});
