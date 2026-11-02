# CULTURE SPACE — Architecture Consistency Review

**Status:** APPROVED  
**Documents:** version 0.4  
**Approved:** 2026-11-02 by the product owner, as proposed  
**Product source of truth:** `PROJECT_SPEC.md`  
**Reviewed documents:** `AGENTS.md`, `ARCHITECTURE.md`, `DATABASE.md`, `GRAPHQL_API.md`, `DEVELOPMENT_PLAN.md`

The product owner approved version 0.4. This review does not start Milestone 1.

---

## 1. Executive summary

Version 0.4 is the approved baseline. D-01 through D-68 are approved. Q-22 option A and Q-24 option A are confirmed. Episode-by-episode tracking, Socket.IO, and account deletion stay out of the MVP. Q-21 stays open until the Milestone 3 genre gate.

The approved corrections remain in force. A permanently failed BullMQ job is recorded on the existing outbox row and can be retried by an administrator without a second domain event. `progress_conflict` is tested in Milestone 4, when `library_items` exists.

**Verdict: APPROVED.** Milestone 1 — Foundation has not started. It waits for a separate explicit instruction.

---

## 2. Critical findings

None remain open.

Club ownership, exclusive subject foreign keys, the deferred work-detail check, and library deletion were already aligned. The new recovery path does not insert a second outbox row and does not change `dedupe_key`.

---

## 3. Major findings

No major contract gap remains open after the corrections in section 5.

Earlier version 0.4 fixes stay in force: `comments.reaction_count`, defined GraphQL inputs, the `reviews` and `library` dependency on `activity`, and the outbox hand-off that sets `published_at` only after BullMQ accepts the job.

---

## 4. Minor findings

None remain from this correction pass.

Series watch time stays omitted under D-64. Episode tables stay deferred under D-06. Those are explicit, not silent removals.

---

## 5. Corrections applied

### 5.1. Q-22 and Q-24 confirmed

| Question | Confirmed answer |
| --- | --- |
| Q-22 | Option A. Unfollow keeps the `NEW_FOLLOWER` row, sets `subject_detached`, clears `follow_id`, keeps the actor and `subject_snapshot`, then deletes the follow |
| Q-24 | Option A. A smaller page count or season count keeps the user's progress and status and sets `progress_conflict` |

Updated in `ARCHITECTURE.md` sections 20.1, 20.2, 24.1, and 24.11, `DATABASE.md` section 10, `GRAPHQL_API.md` unfollow, library, and notification text, and `DEVELOPMENT_PLAN.md` Milestones 4 and 8 and the approval checklist. Options B and C are rejected. Q-23 stays closed.

### 5.2. Outbox recovery

`published_at` still means the job was handed to BullMQ. The worker commits `processed_at` before BullMQ marks the job completed. When all 5 attempts fail, the listener sets `processing_failed_at` on that same row. Startup reconciliation starts from published, unprocessed PostgreSQL rows and reads each BullMQ state. It marks only `failed` and missing jobs. `active`, `waiting`, `delayed`, and `completed` stay unmarked. The scan does not enqueue and does not change `dedupe_key` or `payload`. Q-22 option A and Q-24 option A are unchanged.

`retryFailedOutboxMessage` is admin-only. It retries the same job id, or enqueues that id again when Redis has lost the job, then clears the failure mark. It does not insert a row and does not change `dedupe_key` or `payload`. `failedOutboxMessages` does not return the payload.

Domain handlers stay idempotent. SMTP does not. A crash after the server accepts a message and before `processed_at` can send the same token email again. Recovery does not create a second token.

Integration coverage:

| Milestone | Cases |
| --- | --- |
| 2 | Permanent failure, admin recovery, duplicate delivery, worker crash before the side effect, worker crash after session deletion, SMTP duplicate with one token row, reconciliation of a missed `failed` event, a job missing from Redis, and unmarked `active`, `waiting`, `delayed`, and `completed` jobs |
| 3 | A failed `REFRESH_WORK` recovery still leaves one work for that external id. No `library_items` fixture |
| 8 | Duplicate `CREATE_NOTIFICATION` and recovery of a permanently failed notification insert one row |

### 5.3. Milestone order for `progress_conflict`

Milestone 3 refreshes catalog rows only, including a nightly refresh of works older than 30 days. Its tests do not create `library_items`. Milestone 4 adds the table, the status trigger, and the refresh update that sets or clears `progress_conflict`. The shrink test runs there, after the table and the trigger exist. Confirmed Q-24 option A is the behavior of that update. From Milestone 4 the nightly refresh also requires at least one library row.

---

## 6. Remaining risks

| Risk | Why it remains |
| --- | --- |
| Duplicate SMTP delivery | The mail server has no idempotency key. The same token email can be sent twice. The token row is not duplicated |
| Failed jobs need an operator | Recovery is not automatic. A permanently failed verification email waits for `retryFailedOutboxMessage` |
| Redis loss of a job | Reconciliation marks a published row only when `getJob` returns null. Pending and completed states are not treated as loss. Admin retry of a missing job can still duplicate an SMTP send that happened before `processed_at` |
| Completed job without `processed_at` | Reconciliation does not mark or retry it. The worker commits `processed_at` before completion, so this pair means the acknowledgement and the database write diverged |
| Q-21 genre list | Still required before the Milestone 3 seed. The rest of version 0.4 is approved |

---

## 7. Approval record

The product owner approved architecture version 0.4 as proposed on 2026-11-02. The same record is in `ARCHITECTURE.md` section 23, `DATABASE.md` section 10, `GRAPHQL_API.md`, and `DEVELOPMENT_PLAN.md` section 16.

| Item | Record |
| --- | --- |
| D-01 through D-68 | Approved, text unchanged |
| Q-22 | Confirmed option A. Historical `NEW_FOLLOWER` notifications stay, with the follow reference detached and the snapshot retained |
| Q-24 | Confirmed option A. User progress and status stay when an external total shrinks, and `progress_conflict` is set |
| Episode tracking | Deferred. No episode-by-episode tracking in the MVP |
| Realtime | GraphQL subscriptions. Socket.IO stays deferred |
| Account deletion | Out of the MVP |
| Q-21 | Open until the Milestone 3 product gate |
| Q-23 | Closed |
| Q-01 through Q-20 | Accepted as proposed in `ARCHITECTURE.md` section 20 |

`PROJECT_SPEC.md` was not changed. No application code, migration, or dependency install is part of this approval. Milestone 1 does not start until a separate explicit instruction.

---

## 8. Final verdict

**APPROVED**

Version 0.4 is the project baseline. Milestone 1 — Foundation is not started.
