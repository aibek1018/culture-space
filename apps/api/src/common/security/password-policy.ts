import { DomainError } from '../errors/domain-error';

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

export function assertPasswordPolicy(password: string): void {
  if (
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  ) {
    throw new DomainError(
      'VALIDATION',
      'validation.invalid',
      'Password must be between 10 and 128 characters',
    );
  }
}

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;

export function assertUsername(username: string): void {
  if (!USERNAME_PATTERN.test(username)) {
    throw new DomainError(
      'VALIDATION',
      'validation.invalid',
      'Username must be 3 to 30 characters and use only letters, digits, and underscores',
    );
  }
}
