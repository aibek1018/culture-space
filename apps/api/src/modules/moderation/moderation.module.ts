import { Module } from '@nestjs/common';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { ModerationResolver } from './moderation.resolver';

@Module({
  imports: [OutboxModule],
  providers: [ModerationResolver],
})
export class ModerationModule {}
