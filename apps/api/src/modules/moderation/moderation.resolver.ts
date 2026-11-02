import {
  Args,
  Field,
  Mutation,
  ObjectType,
  Query,
  Resolver,
} from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { GraphQLISODateTime } from '@nestjs/graphql';
import {
  AuthenticatedGuard,
  Roles,
  RolesGuard,
  VerifiedGuard,
} from '../../common/auth/guards';
import { AccountRole, OutboxMessageType } from '../../common/graphql/enums';
import { UuidScalar } from '../../common/graphql/uuid.scalar';
import {
  OutboxRuntime,
  type OutboxFailureView,
} from '../../infrastructure/outbox/outbox.runtime';

@ObjectType('OutboxFailure')
export class OutboxFailureModel {
  @Field(() => UuidScalar)
  id!: string;

  @Field(() => OutboxMessageType)
  messageType!: OutboxMessageType;

  @Field()
  dedupeKey!: string;

  @Field(() => GraphQLISODateTime)
  processingFailedAt!: Date;

  @Field(() => String, { nullable: true })
  processingError!: string | null;
}

@Resolver()
export class ModerationResolver {
  constructor(private readonly outbox: OutboxRuntime) {}

  @Query(() => [OutboxFailureModel])
  @UseGuards(AuthenticatedGuard, VerifiedGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  async failedOutboxMessages(): Promise<OutboxFailureModel[]> {
    const rows = await this.outbox.listFailed();
    return rows.map(toOutboxFailure);
  }

  @Mutation(() => Boolean)
  @UseGuards(AuthenticatedGuard, VerifiedGuard, RolesGuard)
  @Roles(AccountRole.ADMIN)
  async retryFailedOutboxMessage(
    @Args('id', { type: () => UuidScalar }) id: string,
  ): Promise<boolean> {
    await this.outbox.retryFailed(id);
    return true;
  }
}

function toOutboxFailure(row: OutboxFailureView): OutboxFailureModel {
  return {
    id: row.id,
    messageType: OutboxMessageType[row.messageType],
    dedupeKey: row.dedupeKey,
    processingFailedAt: row.processingFailedAt,
    processingError: row.processingError,
  };
}
