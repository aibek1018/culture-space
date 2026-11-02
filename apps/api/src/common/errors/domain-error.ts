export const DOMAIN_CODES = [
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'EMAIL_NOT_VERIFIED',
  'NOT_FOUND',
  'CONFLICT',
  'VALIDATION',
  'RATE_LIMITED',
  'EXTERNAL_UNAVAILABLE',
] as const;

export type DomainCode = (typeof DOMAIN_CODES)[number];

/**
 * Typed product error. The GraphQL formatter exposes `code` and `i18nKey` only.
 */
export class DomainError extends Error {
  readonly code: DomainCode;
  readonly i18nKey: string;

  constructor(code: DomainCode, i18nKey: string, message: string) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.i18nKey = i18nKey;
  }
}
