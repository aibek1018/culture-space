export function postgresErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  const code = error.code;
  return typeof code === 'string' ? code : null;
}

export function postgresConstraint(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('constraint' in error)) {
    return null;
  }
  const constraint = error.constraint;
  return typeof constraint === 'string' ? constraint : null;
}
