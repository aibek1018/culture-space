import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { StorageModule } from '../../infrastructure/storage/storage.module';
import { ACCOUNT_READER } from '../../common/auth/current-account';
import { AvatarService } from './avatar.service';
import { FavoritesService } from './favorites.service';
import { FollowService } from './follow.service';
import { ProfileService } from './profile.service';
import { UserRepository } from './user.repository';
import { UsersResolver } from './users.resolver';

@Module({
  imports: [DatabaseModule, StorageModule],
  providers: [
    UserRepository,
    ProfileService,
    FollowService,
    FavoritesService,
    AvatarService,
    UsersResolver,
    { provide: ACCOUNT_READER, useExisting: UserRepository },
  ],
  exports: [UserRepository, ProfileService, ACCOUNT_READER],
})
export class UsersModule {}
