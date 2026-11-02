import { GraphQLFormattedError } from 'graphql';

/**
 * Drops stack traces and unexpected extension fields.
 * Domain errors keep `extensions.code` and `extensions.i18nKey`.
 */
export function formatGraphQLError(
  formattedError: GraphQLFormattedError,
): GraphQLFormattedError {
  const code = formattedError.extensions?.code;
  const i18nKey = formattedError.extensions?.i18nKey;

  return {
    message: formattedError.message,
    ...(formattedError.locations !== undefined
      ? { locations: formattedError.locations }
      : {}),
    ...(formattedError.path !== undefined ? { path: formattedError.path } : {}),
    extensions: {
      code: typeof code === 'string' ? code : 'INTERNAL_SERVER_ERROR',
      ...(typeof i18nKey === 'string' ? { i18nKey } : {}),
    },
  };
}
