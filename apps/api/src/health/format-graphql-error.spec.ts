import { formatGraphQLError } from './format-graphql-error';

describe('formatGraphQLError', () => {
  it('removes stack traces and keeps the error code', () => {
    const formatted = formatGraphQLError({
      message: 'Something failed',
      locations: [{ line: 1, column: 2 }],
      path: ['foundationHealth'],
      extensions: {
        code: 'UNAUTHENTICATED',
        i18nKey: 'auth.unauthenticated',
        stacktrace: ['Error: Something failed', 'at hidden'],
        password: 'should-not-leak',
      },
    });

    expect(formatted).toEqual({
      message: 'Something failed',
      locations: [{ line: 1, column: 2 }],
      path: ['foundationHealth'],
      extensions: {
        code: 'UNAUTHENTICATED',
        i18nKey: 'auth.unauthenticated',
      },
    });
    expect(JSON.stringify(formatted)).not.toContain('stacktrace');
    expect(JSON.stringify(formatted)).not.toContain('at hidden');
    expect(JSON.stringify(formatted)).not.toContain('should-not-leak');
  });
});
