export const FAVORITE_GENRE_LIMIT = 20;
export const FAVORITE_PERSON_LIMIT = 50;

export type FavoriteDecision = 'empty' | 'too_many' | 'catalog_unavailable';

/**
 * Genre and person rows do not exist until Milestone 3. An empty replacement
 * has nothing to store. Any real id cannot be checked against a catalog table,
 * so the mutation reports that the catalog is unavailable instead of writing
 * a junction row without its foreign key.
 */
export function decideFavoriteReplacement(
  count: number,
  max: number,
): FavoriteDecision {
  if (count > max) {
    return 'too_many';
  }
  if (count === 0) {
    return 'empty';
  }
  return 'catalog_unavailable';
}
