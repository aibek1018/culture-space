import { Kind, type DocumentNode, type SelectionNode } from 'graphql';
import { GraphQLError } from 'graphql';
import {
  getComplexity,
  simpleEstimator,
  type ComplexityEstimator,
} from 'graphql-query-complexity';
import type { GraphQLSchema } from 'graphql';

const MAX_DEPTH = 10;
const MAX_COMPLEXITY = 200;

const connectionEstimator: ComplexityEstimator = ({
  field,
  args,
  childComplexity,
}) => {
  if (field.name !== 'followers' && field.name !== 'following') {
    return;
  }
  const requested = args.pageSize;
  const pageSize = typeof requested === 'number' ? requested : 20;
  const bounded = Math.min(Math.max(pageSize, 1), 50);
  return bounded + childComplexity;
};

export function assertGraphqlBudget(
  schema: GraphQLSchema,
  document: DocumentNode,
  variables: Record<string, unknown> | undefined,
  operationName: string | null | undefined,
): void {
  if (isIntrospection(document)) {
    return;
  }
  const depth = documentDepth(document);
  if (depth > MAX_DEPTH) {
    throw new GraphQLError('Query is too deep', {
      extensions: { code: 'VALIDATION', i18nKey: 'graphql.too_deep' },
    });
  }
  const complexity = getComplexity({
    schema,
    query: document,
    variables,
    operationName: operationName ?? undefined,
    estimators: [
      connectionEstimator,
      simpleEstimator({ defaultComplexity: 1 }),
    ],
  });
  if (complexity > MAX_COMPLEXITY) {
    throw new GraphQLError('Query is too complex', {
      extensions: { code: 'VALIDATION', i18nKey: 'graphql.too_complex' },
    });
  }
}

function isIntrospection(document: DocumentNode): boolean {
  for (const definition of document.definitions) {
    if (definition.kind !== Kind.OPERATION_DEFINITION) {
      continue;
    }
    if (containsIntrospection(definition.selectionSet.selections)) {
      return true;
    }
  }
  return false;
}

function containsIntrospection(selections: readonly SelectionNode[]): boolean {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      if (
        selection.name.value === '__schema' ||
        selection.name.value === '__type'
      ) {
        return true;
      }
      if (
        selection.selectionSet &&
        containsIntrospection(selection.selectionSet.selections)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function documentDepth(document: DocumentNode): number {
  const fragments = new Map<string, readonly SelectionNode[]>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) {
      fragments.set(definition.name.value, definition.selectionSet.selections);
    }
  }
  let max = 0;
  for (const definition of document.definitions) {
    if (definition.kind === Kind.OPERATION_DEFINITION) {
      max = Math.max(
        max,
        selectionDepth(
          definition.selectionSet.selections,
          fragments,
          0,
          new Set(),
        ),
      );
    }
  }
  return max;
}

function selectionDepth(
  selections: readonly SelectionNode[],
  fragments: Map<string, readonly SelectionNode[]>,
  depth: number,
  stack: Set<string>,
): number {
  let max = depth;
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      const next = depth + 1;
      if (selection.selectionSet) {
        max = Math.max(
          max,
          selectionDepth(
            selection.selectionSet.selections,
            fragments,
            next,
            stack,
          ),
        );
      } else {
        max = Math.max(max, next);
      }
    } else if (
      selection.kind === Kind.INLINE_FRAGMENT &&
      selection.selectionSet
    ) {
      max = Math.max(
        max,
        selectionDepth(
          selection.selectionSet.selections,
          fragments,
          depth,
          stack,
        ),
      );
    } else if (selection.kind === Kind.FRAGMENT_SPREAD) {
      const name = selection.name.value;
      if (stack.has(name)) {
        continue;
      }
      const fragment = fragments.get(name);
      if (fragment === undefined) {
        continue;
      }
      stack.add(name);
      max = Math.max(max, selectionDepth(fragment, fragments, depth, stack));
      stack.delete(name);
    }
  }
  return max;
}
