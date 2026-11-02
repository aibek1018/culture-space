import type { Request } from 'express';
import { DomainError } from '../errors/domain-error';

const CLIENT_HEADER = 'x-culturespace-client';

function header(req: Request, name: string): string | undefined {
  const value = req.headers[name];
  if (Array.isArray(value)) {
    return value[0];
  }
  return value;
}

/**
 * Same-origin mutation defense: Origin or Referer must match the application
 * origin, and the client header must be present. A classic cross-site form
 * post does not send that header.
 */
export function assertMutationOrigin(req: Request, appOrigin: string): void {
  const expected = new URL(appOrigin).origin;
  const origin = header(req, 'origin');
  const referer = header(req, 'referer');

  if (origin === undefined && referer === undefined) {
    throw csrfError();
  }
  if (origin !== undefined && origin !== expected) {
    throw csrfError();
  }
  if (referer !== undefined) {
    let refererOrigin: string;
    try {
      refererOrigin = new URL(referer).origin;
    } catch {
      throw csrfError();
    }
    if (refererOrigin !== expected) {
      throw csrfError();
    }
  }
  if (header(req, CLIENT_HEADER) !== 'web') {
    throw csrfError();
  }
}

function csrfError(): DomainError {
  return new DomainError('FORBIDDEN', 'auth.csrf', 'The request was rejected');
}
