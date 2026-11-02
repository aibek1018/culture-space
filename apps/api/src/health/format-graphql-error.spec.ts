import { formatGraphQLError } from './format-graphql-error';

describe('formatGraphQLError', () => {
  it('removes stack traces and keeps the error code', () => {
    const formatted = formatGraphQLError({
      message: 'Something failed',
      locations: [{ line: 1, column: 2 }],
      path: ['foundationHealth'],
      extensions: {
        code: 'INTERNAL_SERVER_ERROR',
        stacktrace: ['Error: Something failed', 'at hidden'],
      },
    });

    expect(formatted).toEqual({
      message: 'Something failed',
      locations: [{ line: 1, column: 2 }],
      path: ['foundationHealth'],
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
    expect(JSON.stringify(formatted)).not.toContain('stacktrace');
    expect(JSON.stringify(formatted)).not.toContain('at hidden');
  });
});
