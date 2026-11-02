import { Column, Entity, JoinColumn, ManyToOne, PrimaryColumn } from 'typeorm';
import { UserEntity } from './user.entity';

@Entity({ name: 'follows' })
export class FollowEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column('uuid', { name: 'follower_id' })
  followerId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'follower_id' })
  follower!: UserEntity;

  @Column('uuid', { name: 'following_id' })
  followingId!: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'following_id' })
  following!: UserEntity;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
