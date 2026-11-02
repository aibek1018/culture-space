import { Query, Resolver } from '@nestjs/graphql';

/**
 * TEMPORARY FOUNDATION SCAFFOLDING.
 *
 * This query exists only so Milestone 1 can prove that GraphQL Code First
 * generates a schema from decorated TypeScript. It is not part of the product
 * contract in GRAPHQL_API.md.
 *
 * Remove FoundationHealthResolver before production.
 */
@Resolver()
export class FoundationHealthResolver {
  @Query(() => String, {
    description:
      'Temporary foundation probe. Remove this query before production.',
  })
  foundationHealth(): string {
    return 'ok';
  }
}
