import { DomainError } from '../../common/errors/domain-error';

export function parseCountryCode(value: string): string {
  const code = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    throw new DomainError(
      'VALIDATION',
      'validation.invalid',
      'Country code must be an ISO 3166-1 alpha-2 value',
    );
  }
  let displayName: string | undefined;
  try {
    displayName = new Intl.DisplayNames(['en'], { type: 'region' }).of(code);
  } catch {
    displayName = undefined;
  }
  if (displayName === undefined || displayName.toUpperCase() === code) {
    throw new DomainError(
      'VALIDATION',
      'validation.invalid',
      'Country code must be an ISO 3166-1 alpha-2 value',
    );
  }
  return code;
}

export function emptyToNull(
  value: string | null | undefined,
): string | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
