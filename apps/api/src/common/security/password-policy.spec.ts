import { assertPasswordPolicy, assertUsername } from './password-policy';
import { DomainError } from '../errors/domain-error';

describe('password and username policy', () => {
  it('accepts a password inside the approved length', () => {
    expect(() => assertPasswordPolicy('correct-horse')).not.toThrow();
  });

  it('rejects passwords outside 10 to 128 characters', () => {
    expect(() => assertPasswordPolicy('short')).toThrow(DomainError);
    expect(() => assertPasswordPolicy('x'.repeat(129))).toThrow(DomainError);
  });

  it('rejects usernames outside the approved pattern', () => {
    expect(() => assertUsername('ab')).toThrow(DomainError);
    expect(() => assertUsername('has space')).toThrow(DomainError);
    expect(() => assertUsername('valid_name')).not.toThrow();
  });
});
