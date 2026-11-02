import 'reflect-metadata';
import { OutboxMessageEntity } from '../infrastructure/outbox/outbox-message.entity';
import { EmailVerificationTokenEntity } from '../modules/users/entities/email-verification-token.entity';
import { FollowEntity } from '../modules/users/entities/follow.entity';
import { PasswordResetTokenEntity } from '../modules/users/entities/password-reset-token.entity';
import { UserPreferenceEntity } from '../modules/users/entities/user-preference.entity';
import { UserRestrictionEntity } from '../modules/users/entities/user-restriction.entity';
import { UserEntity } from '../modules/users/entities/user.entity';

/**
 * Milestone 2 entities. Favorite junctions are absent until Milestone 3
 * creates `genres` and `persons`, because those foreign keys cannot be
 * declared against tables that do not exist.
 */
export const identityEntities = [
  UserEntity,
  UserPreferenceEntity,
  EmailVerificationTokenEntity,
  PasswordResetTokenEntity,
  UserRestrictionEntity,
  FollowEntity,
  OutboxMessageEntity,
];
