import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Request } from 'express';
import { from, type Observable, switchMap } from 'rxjs';
import { AppConfigService } from '../../config/app-config.service';
import { RateLimitService } from '../../infrastructure/redis/rate-limit.service';
import { DomainError } from '../errors/domain-error';
import { clientIp } from '../security/client-ip';
import { assertMutationOrigin } from '../security/csrf';

@Injectable()
export class GraphqlGuardrailsInterceptor implements NestInterceptor {
  constructor(
    private readonly config: AppConfigService,
    private readonly rateLimit: RateLimitService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType<string>() !== 'graphql') {
      return next.handle();
    }
    const graphql = GqlExecutionContext.create(context);
    const request = graphql.getContext<{ req: Request }>().req;
    const operation = graphql.getInfo().operation.operation;
    if (operation === 'mutation') {
      assertMutationOrigin(request, this.config.appOrigin);
    }
    const limited = this.rateLimit
      .consumeGraphql(clientIp(request, this.config.nodeEnv))
      .catch((error: unknown) => {
        if (error instanceof DomainError) {
          throw error;
        }
        // Queries stay available when the counter cannot be stored.
        // Mutations, including public authentication, do not run without it.
        if (operation === 'mutation') {
          throw new DomainError(
            'EXTERNAL_UNAVAILABLE',
            'auth.rate_limit_unavailable',
            'Abuse protection is temporarily unavailable',
          );
        }
      });
    return from(limited).pipe(switchMap(() => next.handle()));
  }
}
