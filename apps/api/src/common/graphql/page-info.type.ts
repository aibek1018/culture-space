import { Field, ObjectType } from '@nestjs/graphql';
import { DomainError } from '../errors/domain-error';

@ObjectType()
export class PageInfo {
  @Field(() => String, { nullable: true })
  endCursor!: string | null;

  @Field(() => Boolean)
  hasNextPage!: boolean;
}

export function normalizePageSize(pageSize: number | null | undefined): number {
  if (pageSize === null || pageSize === undefined) {
    return 20;
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 50) {
    throw new DomainError(
      'VALIDATION',
      'validation.invalid',
      'Page size must be between 1 and 50',
    );
  }
  return pageSize;
}
