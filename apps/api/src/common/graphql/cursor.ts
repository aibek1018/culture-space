import { DomainError } from '../../common/errors/domain-error';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(
    JSON.stringify({ createdAt: createdAt.toISOString(), id }),
    'utf8',
  ).toString('base64url');
}

export function decodeCursor(value: string): { createdAt: string; id: string } {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (typeof parsed !== 'object' || parsed === null) {
      throw new Error('invalid');
    }
    const createdAt = Reflect.get(parsed, 'createdAt');
    const id = Reflect.get(parsed, 'id');
    if (typeof createdAt !== 'string' || typeof id !== 'string') {
      throw new Error('invalid');
    }
    if (!UUID_PATTERN.test(id) || Number.isNaN(Date.parse(createdAt))) {
      throw new Error('invalid');
    }
    return { createdAt, id };
  } catch (error) {
    if (error instanceof DomainError) {
      throw error;
    }
    throw new DomainError('VALIDATION', 'validation.invalid', 'Invalid cursor');
  }
}
