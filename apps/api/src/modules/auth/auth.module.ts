import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { OutboxModule } from '../../infrastructure/outbox/outbox.module';
import { RedisModule } from '../../infrastructure/redis/redis.module';
import { UsersModule } from '../users/users.module';
import { AuthResolver } from './auth.resolver';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

@Module({
  imports: [DatabaseModule, RedisModule, UsersModule, OutboxModule],
  providers: [PasswordService, AuthService, AuthResolver],
  exports: [PasswordService, AuthService],
})
export class AuthModule {}
