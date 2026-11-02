/** Worker and enqueue errors stored in PostgreSQL. Tokens are stripped. */
export function publicError(error: unknown): string {
  const message =
    error instanceof Error ? error.message : 'Background work failed';
  return message.replace(/token=[^\s&]+/gi, 'token=[redacted]').slice(0, 500);
}
