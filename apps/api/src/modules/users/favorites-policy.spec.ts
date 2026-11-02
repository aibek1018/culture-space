import { decideFavoriteReplacement } from './favorites-policy';

describe('favorite staging policy', () => {
  it('treats an empty replacement as a no-op and a real id as catalog-unavailable', () => {
    expect(decideFavoriteReplacement(0, 20)).toBe('empty');
    expect(decideFavoriteReplacement(21, 20)).toBe('too_many');
    expect(decideFavoriteReplacement(1, 20)).toBe('catalog_unavailable');
  });
});
