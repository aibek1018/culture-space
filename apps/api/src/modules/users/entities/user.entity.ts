import { Column, Entity, PrimaryColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 30 })
  username!: string;

  @Column({ name: 'full_name', type: 'varchar', length: 100 })
  fullName!: string;

  @Column({ type: 'varchar', length: 320 })
  email!: string;

  @Column({
    name: 'password_hash',
    type: 'varchar',
    length: 255,
    select: false,
  })
  passwordHash!: string;

  @Column({ name: 'avatar_url', type: 'varchar', length: 2048, nullable: true })
  avatarUrl!: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  bio!: string | null;

  @Column({ name: 'preferred_language', type: 'varchar', length: 5 })
  preferredLanguage!: 'en' | 'ru';

  @Column({ name: 'country_code', type: 'char', length: 2, nullable: true })
  countryCode!: string | null;

  @Column({ type: 'varchar', length: 20, default: 'USER' })
  role!: 'USER' | 'MODERATOR' | 'ADMIN';

  @Column({
    name: 'profile_visibility',
    type: 'varchar',
    length: 20,
    default: 'PUBLIC',
  })
  profileVisibility!: 'PUBLIC' | 'PRIVATE';

  @Column({
    name: 'library_visibility',
    type: 'varchar',
    length: 20,
    default: 'PUBLIC',
  })
  libraryVisibility!: 'PUBLIC' | 'PRIVATE';

  @Column({
    name: 'account_status',
    type: 'varchar',
    length: 20,
    default: 'ACTIVE',
  })
  accountStatus!: 'ACTIVE' | 'SUSPENDED';

  @Column({ name: 'email_verified_at', type: 'timestamptz', nullable: true })
  emailVerifiedAt!: Date | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
