import { Field, InputType } from '@nestjs/graphql';
import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  InterfaceLanguage,
  LibraryVisibility,
  ProfileVisibility,
} from '../../../common/graphql/enums';

@InputType()
export class RegisterInput {
  @Field()
  @IsString()
  @Length(3, 30)
  @Matches(/^[A-Za-z0-9_]+$/)
  username!: string;

  @Field()
  @IsString()
  @Length(1, 100)
  fullName!: string;

  @Field()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Field()
  @IsString()
  @Length(10, 128)
  password!: string;

  @Field(() => InterfaceLanguage)
  @IsEnum(InterfaceLanguage)
  preferredLanguage!: InterfaceLanguage;
}

@InputType()
export class LoginInput {
  @Field()
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @Field()
  @IsString()
  @Length(10, 128)
  password!: string;
}

@InputType()
export class ResetPasswordInput {
  @Field()
  @IsString()
  @Length(20, 200)
  token!: string;

  @Field()
  @IsString()
  @Length(10, 128)
  newPassword!: string;
}

@InputType()
export class ChangePasswordInput {
  @Field()
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @Field()
  @IsString()
  @Length(10, 128)
  newPassword!: string;
}

@InputType()
export class UpdateProfileInput {
  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(1, 100)
  fullName?: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  bio?: string | null;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2)
  countryCode?: string | null;

  @Field(() => InterfaceLanguage, { nullable: true })
  @IsOptional()
  @IsEnum(InterfaceLanguage)
  preferredLanguage?: InterfaceLanguage;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @Length(3, 30)
  @Matches(/^[A-Za-z0-9_]+$/)
  username?: string;
}

@InputType()
export class UpdatePrivacyInput {
  @Field(() => ProfileVisibility)
  @IsEnum(ProfileVisibility)
  profileVisibility!: ProfileVisibility;

  @Field(() => LibraryVisibility)
  @IsEnum(LibraryVisibility)
  libraryVisibility!: LibraryVisibility;
}
