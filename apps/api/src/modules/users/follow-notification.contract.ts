import type { EntityManager } from 'typeorm';

/**
 * Milestone-compatible Q-22 contract.
 *
 * Milestone 8 owns the `notifications` table and `CREATE_NOTIFICATION`.
 * Until that table exists, there is no follower notification to detach.
 * When it exists, unfollow keeps the historical `NEW_FOLLOWER` row, sets
 * `subject_detached`, clears `follow_id`, and leaves `subject_snapshot`
 * and `actor_id` untouched. It then deletes the follow.
 *
 * Milestone 8 must use this outbox dedupe key for that notification:
 * `NEW_FOLLOWER:{recipientId}:{followId}`.
 * Unpublished rows with that key are removed in the same transaction.
 * This milestone does not insert `CREATE_NOTIFICATION` rows.
 */
export function followerNotificationDedupeKey(
  recipientId: string,
  followId: string,
): string {
  return `NEW_FOLLOWER:${recipientId}:${followId}`;
}

export async function detachFollowerNotification(
  manager: EntityManager,
  followId: string,
  recipientId: string,
): Promise<void> {
  const registered: unknown = await manager.query(
    `SELECT to_regclass('public.notifications') AS name`,
  );
  const relation = Array.isArray(registered) ? registered[0] : undefined;
  const name =
    typeof relation === 'object' && relation !== null
      ? Reflect.get(relation, 'name')
      : null;
  if (typeof name === 'string' && name.length > 0) {
    await manager.query(
      `UPDATE notifications
       SET subject_detached = true,
           follow_id = NULL
       WHERE follow_id = $1
         AND type = 'NEW_FOLLOWER'`,
      [followId],
    );
  }

  await manager.query(
    `DELETE FROM outbox_messages
     WHERE published_at IS NULL
       AND message_type = 'CREATE_NOTIFICATION'
       AND dedupe_key = $1`,
    [followerNotificationDedupeKey(recipientId, followId)],
  );
}
