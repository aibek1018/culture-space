import { Injectable } from '@nestjs/common';
import { DomainError } from '../../common/errors/domain-error';
import { PersonCapacity } from '../../common/graphql/enums';
import {
  decideFavoriteReplacement,
  FAVORITE_GENRE_LIMIT,
  FAVORITE_PERSON_LIMIT,
} from './favorites-policy';

export interface FavoritePersonSelection {
  personId: string;
  capacity: PersonCapacity;
}

@Injectable()
export class FavoritesService {
  setFavoriteGenres(genreIds: string[]): never[] {
    this.assertDistinct(genreIds);
    const decision = decideFavoriteReplacement(
      genreIds.length,
      FAVORITE_GENRE_LIMIT,
    );
    if (decision === 'too_many') {
      throw new DomainError(
        'VALIDATION',
        'validation.invalid',
        'You can save at most 20 favorite genres',
      );
    }
    if (decision === 'catalog_unavailable') {
      throw new DomainError(
        'NOT_FOUND',
        'favorites.catalog_unavailable',
        'Favorite genres are available after the cultural catalog exists',
      );
    }
    return [];
  }

  setFavoritePersons(_input: FavoritePersonSelection[]): never[] {
    const ids = _input.map((item) => `${item.personId}:${item.capacity}`);
    this.assertDistinct(ids);
    const decision = decideFavoriteReplacement(
      _input.length,
      FAVORITE_PERSON_LIMIT,
    );
    if (decision === 'too_many') {
      throw new DomainError(
        'VALIDATION',
        'validation.invalid',
        'You can save at most 50 favorite people',
      );
    }
    if (decision === 'catalog_unavailable') {
      throw new DomainError(
        'NOT_FOUND',
        'favorites.catalog_unavailable',
        'Favorite people are available after the cultural catalog exists',
      );
    }
    return [];
  }

  private assertDistinct(values: string[]): void {
    if (new Set(values).size !== values.length) {
      throw new DomainError(
        'VALIDATION',
        'validation.invalid',
        'Favorite entries must be unique',
      );
    }
  }
}
