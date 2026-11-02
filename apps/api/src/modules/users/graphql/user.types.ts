import {
  Args,
  Field,
  GraphQLISODateTime,
  InputType,
  Int,
  ObjectType,
} from '@nestjs/graphql';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PageInfo } from '../../../common/graphql/page-info.type';
import {
  InterfaceLanguage,
  LibraryVisibility,
  PersonCapacity,
  ProfileVisibility,
  AccountRole,
} from '../../../common/graphql/enums';
import { UuidScalar } from '../../../common/graphql/uuid.scalar';

@ObjectType()
export class UserPreferencesModel {
  @Field()
  showSpoilers!: boolean;

  @Field()
  notifyNewFollower!: boolean;

  @Field()
  notifyReviewLike!: boolean;

  @Field()
  notifyDiscussionLike!: boolean;

  @Field()
  notifyCommentReply!: boolean;

  @Field()
  notifyNewComment!: boolean;

  @Field()
  notifyClubInvitation!: boolean;

  @Field()
  notifyClubMembership!: boolean;

  @Field()
  notifyClubActivity!: boolean;

  @Field()
  notifyClubAnnouncement!: boolean;
}

@ObjectType('Account')
export class AccountModel {
  @Field(() => UuidScalar)
  id!: string;

  @Field()
  username!: string;

  @Field()
  fullName!: string;

  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;

  @Field(() => String, { nullable: true })
  bio!: string | null;

  @Field(() => InterfaceLanguage)
  preferredLanguage!: InterfaceLanguage;

  @Field(() => String, { nullable: true })
  countryCode!: string | null;

  @Field(() => AccountRole)
  role!: AccountRole;

  @Field(() => ProfileVisibility)
  profileVisibility!: ProfileVisibility;

  @Field(() => LibraryVisibility)
  libraryVisibility!: LibraryVisibility;

  @Field(() => GraphQLISODateTime, { nullable: true })
  emailVerifiedAt!: Date | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => UserPreferencesModel)
  preferences!: UserPreferencesModel;
}

@ObjectType('UserProfile')
export class UserProfileModel {
  @Field(() => UuidScalar)
  id!: string;

  @Field()
  username!: string;

  @Field()
  fullName!: string;

  @Field(() => String, { nullable: true })
  avatarUrl!: string | null;

  @Field(() => String, { nullable: true })
  bio!: string | null;

  @Field(() => String, { nullable: true })
  countryCode!: string | null;

  @Field(() => GraphQLISODateTime)
  createdAt!: Date;

  @Field(() => ProfileVisibility)
  profileVisibility!: ProfileVisibility;

  @Field(() => Int)
  followersCount!: number;

  @Field(() => Int)
  followingCount!: number;

  @Field()
  isFollowedByViewer!: boolean;
}

@ObjectType('UserConnection')
export class UserConnectionModel {
  @Field(() => [UserProfileModel])
  nodes!: UserProfileModel[];

  @Field(() => PageInfo)
  pageInfo!: PageInfo;
}

/**
 * Declared so favorite mutations match the approved contract.
 * Catalog queries are Milestone 3. These objects are not returned until
 * `genres` and `persons` exist.
 */
@ObjectType('Genre')
export class GenreModel {
  @Field(() => UuidScalar)
  id!: string;

  @Field()
  slug!: string;

  @Field(() => String)
  name(
    @Args('language', { type: () => InterfaceLanguage })
    _language: InterfaceLanguage,
  ): string {
    return '';
  }
}

@ObjectType('Person')
export class PersonModel {
  @Field(() => UuidScalar)
  id!: string;

  @Field()
  name!: string;

  @Field(() => String, { nullable: true })
  biography!: string | null;

  @Field(() => String, { nullable: true })
  imageUrl!: string | null;
}

@ObjectType('FavoritePerson')
export class FavoritePersonModel {
  @Field(() => PersonModel)
  person!: PersonModel;

  @Field(() => PersonCapacity)
  capacity!: PersonCapacity;
}

@InputType()
export class FavoritePersonInput {
  @Field(() => UuidScalar)
  @IsUUID()
  personId!: string;

  @Field(() => PersonCapacity)
  @IsEnum(PersonCapacity)
  capacity!: PersonCapacity;
}

@InputType()
export class UpdatePreferencesInput {
  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  showSpoilers?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyNewFollower?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyReviewLike?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyDiscussionLike?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyCommentReply?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyNewComment?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyClubInvitation?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyClubMembership?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyClubActivity?: boolean;

  @Field(() => Boolean, { nullable: true })
  @IsOptional()
  @IsBoolean()
  notifyClubAnnouncement?: boolean;
}

@InputType()
export class UploadRequestInput {
  @Field()
  @IsString()
  contentType!: string;

  @Field(() => Int)
  @IsInt()
  @Min(1)
  @Max(2 * 1024 * 1024)
  byteSize!: number;
}

@ObjectType('UploadIntent')
export class UploadIntentModel {
  @Field()
  uploadUrl!: string;

  @Field()
  objectKey!: string;

  @Field(() => GraphQLISODateTime)
  expiresAt!: Date;
}
