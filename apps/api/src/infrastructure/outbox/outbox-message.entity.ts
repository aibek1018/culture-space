import { Column, Entity, PrimaryColumn } from 'typeorm';

export type OutboxMessageType =
  'SEND_EMAIL' | 'INVALIDATE_SESSIONS' | 'CREATE_NOTIFICATION' | 'REFRESH_WORK';

@Entity({ name: 'outbox_messages' })
export class OutboxMessageEntity {
  @PrimaryColumn('uuid')
  id!: string;

  @Column({ name: 'message_type', type: 'varchar', length: 40 })
  messageType!: OutboxMessageType;

  @Column({ type: 'jsonb' })
  payload!: object;

  @Column({ name: 'dedupe_key', type: 'varchar', length: 200 })
  dedupeKey!: string;

  @Column({ name: 'available_at', type: 'timestamptz' })
  availableAt!: Date;

  @Column({ name: 'published_at', type: 'timestamptz', nullable: true })
  publishedAt!: Date | null;

  @Column({ type: 'integer', default: 0 })
  attempts!: number;

  @Column({ name: 'last_error', type: 'varchar', length: 500, nullable: true })
  lastError!: string | null;

  @Column({ name: 'processed_at', type: 'timestamptz', nullable: true })
  processedAt!: Date | null;

  @Column({
    name: 'processing_failed_at',
    type: 'timestamptz',
    nullable: true,
  })
  processingFailedAt!: Date | null;

  @Column({
    name: 'processing_error',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  processingError!: string | null;

  @Column({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
