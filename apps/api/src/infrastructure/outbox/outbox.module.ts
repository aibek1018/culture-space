import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { MailModule } from '../mail/mail.module';
import { SessionModule } from '../session/session.module';
import { OutboxRuntime } from './outbox.runtime';

@Module({
  imports: [DatabaseModule, MailModule, SessionModule],
  providers: [OutboxRuntime],
  exports: [OutboxRuntime, SessionModule],
})
export class OutboxModule {}
