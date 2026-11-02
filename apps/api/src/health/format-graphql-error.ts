import { GraphQLFormattedError } from 'graphql';

/**
 * Drops stack traces and unexpected extension fields.
 * Domain errors will add `extensions.i18nKey` when those errors exist.
 */
export function formatGraphQLError(
  formattedError: GraphQLFormattedError,
): GraphQLFormattedError {
  const code = formattedError.extensions?.code;

  return {
    message: formattedError.message,
    ...(formattedError.locations !== undefined
      ? { locations: formattedError.locations }
      : {}),
    ...(formattedError.path !== undefined ? { path: formattedError.path } : {}),
    extensions: {
      code: typeof code === 'string' ? code : 'INTERNAL_SERVER_ERROR',
    },
  };
}
