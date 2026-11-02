import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { AuthenticatedGuard, VerifiedGuard } from '../../common/auth/guards';
import {
  CurrentAccountParam,
  type CurrentAccount,
} from '../../common/auth/current-account';
import { UuidScalar } from '../../common/graphql/uuid.scalar';
import { AvatarService } from './avatar.service';
import { FavoritesService } from './favorites.service';
import { FollowService } from './follow.service';
import {
  UpdatePreferencesInput,
  UploadRequestInput,
} from './graphql/user.types';
import {
  UpdatePrivacyInput,
  UpdateProfileInput,
} from './graphql/account.inputs';
import {
  AccountModel,
  FavoritePersonInput,
  FavoritePersonModel,
  GenreModel,
  UploadIntentModel,
  UserConnectionModel,
  UserPreferencesModel,
  UserProfileModel,
} from './graphql/user.types';
import {
  ProfileService,
  type AccountView,
  type PreferenceView,
} from './profile.service';
import type { PublicProfile } from './privacy';

@Resolver()
export class UsersResolver {
  constructor(
    private readonly profiles: ProfileService,
    private readonly follows: FollowService,
    private readonly favorites: FavoritesService,
    private readonly avatars: AvatarService,
  ) {}

  @Query(() => AccountModel, { nullable: true })
  me(
    @CurrentAccountParam() account: CurrentAccount | null,
  ): Promise<AccountView | null> {
    if (!account) {
      return Promise.resolve(null);
    }
    return this.profiles.getAccount(account.id);
  }

  @Query(() => UserProfileModel)
  userProfile(
    @Args('username') username: string,
    @CurrentAccountParam() account: CurrentAccount | null,
  ): Promise<PublicProfile> {
    return this.profiles.getPublicProfile(username, account?.id ?? null);
  }

  @Query(() => UserConnectionModel)
  followers(
    @Args('username') username: string,
    @Args('cursor', { type: () => String, nullable: true })
    cursor: string | null,
    @Args('pageSize', { type: () => Int, nullable: true })
    pageSize: number | null,
    @CurrentAccountParam() account: CurrentAccount | null,
  ) {
    return this.follows.followers(username, account, cursor, pageSize);
  }

  @Query(() => UserConnectionModel)
  following(
    @Args('username') username: string,
    @Args('cursor', { type: () => String, nullable: true })
    cursor: string | null,
    @Args('pageSize', { type: () => Int, nullable: true })
    pageSize: number | null,
    @CurrentAccountParam() account: CurrentAccount | null,
  ) {
    return this.follows.following(username, account, cursor, pageSize);
  }

  @Mutation(() => AccountModel)
  @UseGuards(AuthenticatedGuard)
  updateProfile(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('input') input: UpdateProfileInput,
  ): Promise<AccountView> {
    return this.profiles.updateProfile(account.id, input);
  }

  @Mutation(() => UserPreferencesModel)
  @UseGuards(AuthenticatedGuard)
  updatePreferences(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('input') input: UpdatePreferencesInput,
  ): Promise<PreferenceView> {
    return this.profiles.updatePreferences(account.id, input);
  }

  @Mutation(() => AccountModel)
  @UseGuards(AuthenticatedGuard)
  updatePrivacy(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('input') input: UpdatePrivacyInput,
  ): Promise<AccountView> {
    return this.profiles.updatePrivacy(account.id, input);
  }

  @Mutation(() => UserProfileModel)
  @UseGuards(VerifiedGuard)
  followUser(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('username') username: string,
  ): Promise<PublicProfile> {
    return this.follows.follow(account, username);
  }

  @Mutation(() => UserProfileModel)
  @UseGuards(VerifiedGuard)
  unfollowUser(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('username') username: string,
  ): Promise<PublicProfile> {
    return this.follows.unfollow(account, username);
  }

  @Mutation(() => [GenreModel])
  @UseGuards(VerifiedGuard)
  setFavoriteGenres(
    @Args('genreIds', { type: () => [UuidScalar] }) genreIds: string[],
  ): GenreModel[] {
    return this.favorites.setFavoriteGenres(genreIds);
  }

  @Mutation(() => [FavoritePersonModel])
  @UseGuards(VerifiedGuard)
  setFavoritePersons(
    @Args('input', { type: () => [FavoritePersonInput] })
    input: FavoritePersonInput[],
  ): FavoritePersonModel[] {
    return this.favorites.setFavoritePersons(input);
  }

  @Mutation(() => UploadIntentModel)
  @UseGuards(AuthenticatedGuard)
  requestAvatarUpload(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('input') input: UploadRequestInput,
  ) {
    return this.avatars.requestUpload(account.id, input);
  }

  @Mutation(() => AccountModel)
  @UseGuards(AuthenticatedGuard)
  confirmAvatarUpload(
    @CurrentAccountParam() account: CurrentAccount,
    @Args('objectKey') objectKey: string,
  ): Promise<AccountView> {
    return this.avatars.confirmUpload(account.id, objectKey);
  }
}
