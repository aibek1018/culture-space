import { createHash } from 'node:crypto';
import { hashToken } from './tokens';

describe('token hashing', () => {
  it('stores a SHA-256 hex digest and not the raw token', () => {
    const raw = 'raw-token-value';
    const hashed = hashToken(raw);
    expect(hashed).toHaveLength(64);
    expect(hashed).toBe(createHash('sha256').update(raw).digest('hex'));
    expect(hashed).not.toContain(raw);
  });
});
