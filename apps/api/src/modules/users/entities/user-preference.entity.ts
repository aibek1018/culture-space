import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'user_preferences' })
export class UserPreferenceEntity {
  @PrimaryColumn('uuid', { name: 'user_id' })
  userId!: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user!: UserEntity;

  @Column({ name: 'show_spoilers', type: 'boolean', default: false })
  showSpoilers!: boolean;

  @Column({ name: 'notify_new_follower', type: 'boolean', default: true })
  notifyNewFollower!: boolean;

  @Column({ name: 'notify_review_like', type: 'boolean', default: true })
  notifyReviewLike!: boolean;

  @Column({ name: 'notify_discussion_like', type: 'boolean', default: true })
  notifyDiscussionLike!: boolean;

  @Column({ name: 'notify_comment_reply', type: 'boolean', default: true })
  notifyCommentReply!: boolean;

  @Column({ name: 'notify_new_comment', type: 'boolean', default: true })
  notifyNewComment!: boolean;

  @Column({ name: 'notify_club_invitation', type: 'boolean', default: true })
  notifyClubInvitation!: boolean;

  @Column({ name: 'notify_club_membership', type: 'boolean', default: true })
  notifyClubMembership!: boolean;

  @Column({ name: 'notify_club_activity', type: 'boolean', default: true })
  notifyClubActivity!: boolean;

  @Column({ name: 'notify_club_announcement', type: 'boolean', default: true })
  notifyClubAnnouncement!: boolean;

  @Column({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;
}
