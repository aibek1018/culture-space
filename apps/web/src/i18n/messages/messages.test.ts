/// <reference types="jest" />
import en from './en.json';
import ru from './ru.json';

function collectKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value).flatMap(([key, nested]) => {
    const next = prefix.length > 0 ? `${prefix}.${key}` : key;
    return collectKeys(nested, next);
  });
}

describe('foundation messages', () => {
  it('keeps the same keys in English and Russian', () => {
    expect(collectKeys(en).sort()).toEqual(collectKeys(ru).sort());
  });

  it('uses CULTURE SPACE as the visible product name in both locales', () => {
    expect(en.foundation.title).toBe('CULTURE SPACE');
    expect(ru.foundation.title).toBe('CULTURE SPACE');
    expect(en.foundation.status.toLowerCase()).toContain('foundation');
    expect(ru.foundation.status.length).toBeGreaterThan(0);
    expect(en.foundation.status).not.toBe(ru.foundation.status);
  });
});
