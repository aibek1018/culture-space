import { Kind, type ValueNode, GraphQLError } from 'graphql';
import { CustomScalar, Scalar } from '@nestjs/graphql';

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseUuid(value: unknown): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new GraphQLError('Expected a UUID', {
      extensions: { code: 'VALIDATION', i18nKey: 'validation.invalid' },
    });
  }
  return value.toLowerCase();
}

@Scalar('UUID')
export class UuidScalar implements CustomScalar<string, string> {
  description = 'UUID string';

  parseValue(value: unknown): string {
    return parseUuid(value);
  }

  serialize(value: unknown): string {
    return parseUuid(value);
  }

  parseLiteral(ast: ValueNode): string {
    if (ast.kind !== Kind.STRING) {
      throw new GraphQLError('Expected a UUID', {
        extensions: { code: 'VALIDATION', i18nKey: 'validation.invalid' },
      });
    }
    return parseUuid(ast.value);
  }
}
