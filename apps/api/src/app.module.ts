import {
  MiddlewareConsumer,
  Module,
  type NestModule,
  RequestMethod,
} from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import type { Request, Response } from 'express';
import { AppConfigModule } from './config/app-config.module';
import { AppConfigService } from './config/app-config.service';
import { DatabaseModule } from './database/database.module';
import { formatGraphQLError } from './health/format-graphql-error';
import { HealthModule } from './health/health.module';
import { AppLoggerModule } from './infrastructure/logger/logger.module';
import { RedisModule } from './infrastructure/redis/redis.module';
import { SessionMiddleware } from './infrastructure/session/session.middleware';

@Module({
  imports: [
    AppConfigModule,
    AppLoggerModule,
    DatabaseModule,
    RedisModule,
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      inject: [AppConfigService],
      useFactory: (config: AppConfigService): ApolloDriverConfig => ({
        path: '/graphql',
        autoSchemaFile: true,
        sortSchema: true,
        introspection: config.nodeEnv !== 'production',
        playground: false,
        includeStacktraceInErrorResponses: false,
        context: ({ req, res }: { req: Request; res: Response }) => ({
          req,
          res,
        }),
        formatError: formatGraphQLError,
      }),
    }),
    HealthModule,
  ],
  providers: [SessionMiddleware],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(SessionMiddleware).forRoutes({
      path: 'graphql',
      method: RequestMethod.ALL,
    });
  }
}
