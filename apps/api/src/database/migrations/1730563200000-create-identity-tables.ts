import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Expand-only Milestone 2 migration.
 *
 * Creates users, preferences, tokens, restrictions, follows, and outbox_messages.
 * Does not create `genres`, `persons`, `user_favorite_genres`, or
 * `user_favorite_persons`. Those favorite foreign keys wait for the Milestone 3
 * migration that creates the catalog tables. Creating the junctions without
 * those foreign keys would omit a permanent constraint, and creating placeholder
 * catalog tables would start Milestone 3.
 */
export class CreateIdentityTables1730563200000 implements MigrationInterface {
  name = 'CreateIdentityTables1730563200000';

  async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS unaccent');

    await queryRunner.query(`
      CREATE TABLE users (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        username varchar(30) NOT NULL,
        full_name varchar(100) NOT NULL,
        email varchar(320) NOT NULL,
        password_hash varchar(255) NOT NULL,
        avatar_url varchar(2048),
        bio varchar(500),
        preferred_language varchar(5) NOT NULL,
        country_code char(2),
        role varchar(20) NOT NULL DEFAULT 'USER',
        profile_visibility varchar(20) NOT NULL DEFAULT 'PUBLIC',
        library_visibility varchar(20) NOT NULL DEFAULT 'PUBLIC',
        account_status varchar(20) NOT NULL DEFAULT 'ACTIVE',
        email_verified_at timestamptz,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        CONSTRAINT users_username_check CHECK (username ~ '^[A-Za-z0-9_]{3,30}$'),
        CONSTRAINT users_full_name_check CHECK (char_length(btrim(full_name)) BETWEEN 1 AND 100),
        CONSTRAINT users_email_lowercase_check CHECK (email = lower(email)),
        CONSTRAINT users_bio_check CHECK (bio IS NULL OR char_length(bio) <= 500),
        CONSTRAINT users_preferred_language_check CHECK (preferred_language IN ('en', 'ru')),
        CONSTRAINT users_country_code_check CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
        CONSTRAINT users_role_check CHECK (role IN ('USER', 'MODERATOR', 'ADMIN')),
        CONSTRAINT users_profile_visibility_check CHECK (profile_visibility IN ('PUBLIC', 'PRIVATE')),
        CONSTRAINT users_library_visibility_check CHECK (library_visibility IN ('PUBLIC', 'PRIVATE')),
        CONSTRAINT users_account_status_check CHECK (account_status IN ('ACTIVE', 'SUSPENDED'))
      )
    `);
    await queryRunner.query(
      'CREATE UNIQUE INDEX users_username_lower_uidx ON users (lower(username))',
    );
    await queryRunner.query(
      'CREATE UNIQUE INDEX users_email_lower_uidx ON users (lower(email))',
    );
    await queryRunner.query(
      'CREATE INDEX users_account_status_created_at_idx ON users (account_status, created_at DESC)',
    );

    await queryRunner.query(`
      CREATE TABLE user_preferences (
        user_id uuid PRIMARY KEY REFERENCES users (id) ON DELETE CASCADE,
        show_spoilers boolean NOT NULL DEFAULT false,
        notify_new_follower boolean NOT NULL DEFAULT true,
        notify_review_like boolean NOT NULL DEFAULT true,
        notify_discussion_like boolean NOT NULL DEFAULT true,
        notify_comment_reply boolean NOT NULL DEFAULT true,
        notify_new_comment boolean NOT NULL DEFAULT true,
        notify_club_invitation boolean NOT NULL DEFAULT true,
        notify_club_membership boolean NOT NULL DEFAULT true,
        notify_club_activity boolean NOT NULL DEFAULT true,
        notify_club_announcement boolean NOT NULL DEFAULT true,
        updated_at timestamptz NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE email_verification_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL,
        CONSTRAINT email_verification_tokens_token_hash_key UNIQUE (token_hash)
      )
    `);
    await queryRunner.query(`
      CREATE TABLE password_reset_tokens (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL,
        CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE user_restrictions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        type varchar(30) NOT NULL,
        reason varchar(2000) NOT NULL,
        expires_at timestamptz,
        created_by_id uuid NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL,
        CONSTRAINT user_restrictions_type_check CHECK (type IN ('POSTING_SUSPENDED', 'LOGIN_SUSPENDED')),
        CONSTRAINT user_restrictions_reason_check CHECK (char_length(reason) BETWEEN 1 AND 2000)
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX user_restrictions_one_active_uidx
      ON user_restrictions (user_id, type)
      WHERE revoked_at IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE follows (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        follower_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        following_id uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL,
        CONSTRAINT follows_not_self_check CHECK (follower_id <> following_id),
        CONSTRAINT follows_pair_unique UNIQUE (follower_id, following_id)
      )
    `);
    await queryRunner.query(
      'CREATE INDEX follows_following_created_idx ON follows (following_id, created_at DESC)',
    );
    await queryRunner.query(
      'CREATE INDEX follows_follower_created_idx ON follows (follower_id, created_at DESC)',
    );

    await queryRunner.query(`
      CREATE TABLE outbox_messages (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        message_type varchar(40) NOT NULL,
        payload jsonb NOT NULL,
        dedupe_key varchar(200) NOT NULL,
        available_at timestamptz NOT NULL,
        published_at timestamptz,
        attempts integer NOT NULL DEFAULT 0,
        last_error varchar(500),
        processed_at timestamptz,
        processing_failed_at timestamptz,
        processing_error varchar(500),
        created_at timestamptz NOT NULL,
        CONSTRAINT outbox_messages_dedupe_key_key UNIQUE (dedupe_key),
        CONSTRAINT outbox_message_type_check CHECK (
          message_type IN (
            'SEND_EMAIL',
            'INVALIDATE_SESSIONS',
            'CREATE_NOTIFICATION',
            'REFRESH_WORK'
          )
        ),
        CONSTRAINT outbox_not_processed_and_failed_check CHECK (
          processed_at IS NULL OR processing_failed_at IS NULL
        ),
        CONSTRAINT outbox_attempts_check CHECK (attempts >= 0)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX outbox_unpublished_idx
      ON outbox_messages (available_at, id)
      WHERE published_at IS NULL
    `);
    await queryRunner.query(`
      CREATE INDEX outbox_failed_idx
      ON outbox_messages (processing_failed_at, id)
      WHERE processing_failed_at IS NOT NULL
    `);
    await queryRunner.query(`
      CREATE INDEX outbox_inflight_idx
      ON outbox_messages (published_at, id)
      WHERE published_at IS NOT NULL
        AND processed_at IS NULL
        AND processing_failed_at IS NULL
    `);
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE IF EXISTS outbox_messages');
    await queryRunner.query('DROP TABLE IF EXISTS follows');
    await queryRunner.query('DROP TABLE IF EXISTS user_restrictions');
    await queryRunner.query('DROP TABLE IF EXISTS password_reset_tokens');
    await queryRunner.query('DROP TABLE IF EXISTS email_verification_tokens');
    await queryRunner.query('DROP TABLE IF EXISTS user_preferences');
    await queryRunner.query('DROP TABLE IF EXISTS users');
  }
}
