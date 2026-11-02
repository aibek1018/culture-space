import { Catch, type ArgumentsHost, BadRequestException } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import { DomainError } from './domain-error';

@Catch(DomainError, BadRequestException)
export class DomainExceptionFilter implements GqlExceptionFilter {
  catch(
    exception: DomainError | BadRequestException,
    host: ArgumentsHost,
  ): GraphQLError {
    if (host.getType<string>() !== 'graphql') {
      throw exception;
    }

    if (exception instanceof DomainError) {
      return new GraphQLError(exception.message, {
        extensions: { code: exception.code, i18nKey: exception.i18nKey },
      });
    }

    const response = exception.getResponse();
    const message = typeof response === 'string' ? response : 'Invalid input';
    return new GraphQLError(message, {
      extensions: { code: 'VALIDATION', i18nKey: 'validation.invalid' },
    });
  }
}
