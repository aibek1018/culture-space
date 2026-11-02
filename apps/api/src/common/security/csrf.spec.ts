import type { Request } from 'express';
import { assertMutationOrigin } from './csrf';
import { DomainError } from '../errors/domain-error';

function request(headers: Record<string, string>): Request {
  return { headers } as Request;
}

describe('mutation origin checks', () => {
  const origin = 'http://localhost:3000';

  it('accepts the application origin and the client header', () => {
    expect(() =>
      assertMutationOrigin(
        request({
          origin,
          'x-culturespace-client': 'web',
        }),
        origin,
      ),
    ).not.toThrow();
  });

  it('rejects a cross-site origin and a missing client header', () => {
    expect(() =>
      assertMutationOrigin(
        request({
          origin: 'http://evil.example',
          'x-culturespace-client': 'web',
        }),
        origin,
      ),
    ).toThrow(DomainError);
    expect(() => assertMutationOrigin(request({ origin }), origin)).toThrow(
      DomainError,
    );
  });
});
