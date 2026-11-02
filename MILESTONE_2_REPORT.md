# Milestone 2 Report — Authentication and Users

Milestone 2 is implemented on `feature/milestone-2-auth-users`. Catalog, library, review, discussion, and club behavior was not added. Work stops here for product-owner review.

## Implemented functionality

- Registration, email verification, resend, login, logout, and logout from every device.
- Password change and password recovery. Reset tokens are single-use and expire after one hour. Verification tokens expire after 24 hours. Only SHA-256 hashes are stored.
- Argon2id password hashing (`memoryCost` 19456, `timeCost` 2, `parallelism` 1).
- Redis sessions through `express-session` and `connect-redis`. The cookie is `cs.sid`, HttpOnly, `SameSite=Lax`, and `Secure` in production. Login and registration regenerate the session id. Idle lifetime is 14 days. Absolute lifetime is 30 days from `issuedAt`.
- The session stores the user id and issue time. Role, account status, verification, and active restrictions are loaded from PostgreSQL on each GraphQL request.
- Profiles, preferences, and privacy. A private profile also forces a private library. Follower and following lists of a private profile are visible only to the owner and otherwise return the same not-found result as a missing user.
- Follow and unfollow. Unverified users cannot follow. Self-follow is rejected. A repeated follow or unfollow does not create or require a second row.
- Q-22 Option A, without bringing the notifications module forward. If `public.notifications` exists, unfollow sets `subject_detached`, clears `follow_id`, leaves `subject_snapshot` and `actor_id` unchanged, deletes unpublished `CREATE_NOTIFICATION` outbox rows whose dedupe key is `NEW_FOLLOWER:{recipientId}:{followId}`, and then deletes the follow. This milestone does not insert `CREATE_NOTIFICATION` rows.
- Roles `USER`, `MODERATOR`, and `ADMIN`. Authenticated, verified, and role guards. `LOGIN_SUSPENDED` blocks login and authenticated operations. `POSTING_SUSPENDED` blocks follow. The restriction rows are enforced when present. The moderation mutations that would create them are not part of this milestone because they require `moderation_actions`.
- Transactional outbox and a BullMQ worker in the API process for `SEND_EMAIL` and `INVALIDATE_SESSIONS` only. `published_at` means Redis accepted the job. `processed_at` is written after the side effect. Five attempts use exponential backoff. Permanently failed jobs are not retried automatically. Startup reconciliation marks `failed` and missing jobs only. `failedOutboxMessages` does not return the payload. `retryFailedOutboxMessage` keeps `dedupe_key` and the payload.
- Avatar upload intent and confirmation through the S3-compatible storage port. Development uses MinIO.
- Bootstrap command for the first administrator: `pnpm --filter @culture-space/api bootstrap:admin`.
- Mailpit is the development SMTP target. A registration against the Compose API delivered one verification message to Mailpit.

## Database migrations and constraints

Migration: `CreateIdentityTables1730563200000`.

Tables: `users`, `user_preferences`, `email_verification_tokens`, `password_reset_tokens`, `user_restrictions`, `follows`, `outbox_messages`.

Also enabled: `pg_trgm` and `unaccent`. `down()` drops the tables and does not drop the extensions.

Enforced in this migration:

- UUID primary keys.
- Case-insensitive unique indexes on `lower(email)` and `lower(username)`.
- Email stored in lowercase. Username pattern, name, bio, language, country, role, visibility, and account-status checks.
- Token hashes are `char(64)` and unique. Preferences cascade with the user. Restrictions use `ON DELETE RESTRICT` and one active row per user and type. Follows forbid `follower_id = following_id` and are unique per pair.
- Outbox type check includes later message types so those rows can be stored without handling them. `processed_at` and `processing_failed_at` cannot both be set. `dedupe_key` is unique.

`synchronize` remains false. The CLI `pnpm migration:run` and `pnpm migration:show` work. On the development database, `migration:show` reports:

```text
[X] 1 CreateIdentityTables1730563200000
```

Integration tests apply the same migration to a new `culturespace_test` database.

### Favorite tables

`user_favorite_genres` and `user_favorite_persons` are not in this migration. `genres` and `persons` are Milestone 3. Creating the junction tables without those foreign keys would omit a permanent constraint, and creating placeholder catalog tables would start Milestone 3. The same staging rule used for `progress_conflict` applies: the tables stay absent until the referenced tables exist.

`setFavoriteGenres` and `setFavoritePersons` still exist. An empty selection succeeds and returns an empty list. More than 20 genres or 50 persons is a validation error. Any real id returns `NOT_FOUND` / `favorites.catalog_unavailable`. No favorite row is written.

## GraphQL operations

Authentication: `register`, `login`, `logout`, `logoutAll`, `verifyEmail`, `resendVerificationEmail`, `requestPasswordReset`, `resetPassword`, `changePassword`.

Users: `me`, `userProfile`, `followers`, `following`, `updateProfile`, `updatePreferences`, `updatePrivacy`, `followUser`, `unfollowUser`, `setFavoriteGenres`, `setFavoritePersons`, `requestAvatarUpload`, `confirmAvatarUpload`.

Admin outbox: `failedOutboxMessages`, `retryFailedOutboxMessage`.

There is no REST authentication API. `foundationHealth` remains from Milestone 1 and is still temporary.

Mutations require `Origin` or `Referer` matching `APP_ORIGIN` and the header `x-culturespace-client: web`. Public profile types do not include email, password hash, preferences, or account status. Unknown email and wrong password share `auth.invalid_credentials`. Password reset always returns true, including for an unknown email and when the hourly limit is exceeded.

## Authentication and session security

- Argon2id as above. A missing account still runs a dummy verification.
- Raw verification and reset tokens are 32 random bytes, base64url. PostgreSQL stores only the SHA-256 hex digest. Invalid, expired, and used tokens share `auth.token_invalid`.
- Session fixation is addressed by regenerating the session id before the user id is stored. The previous session key is removed.
- Password change invalidates every other session and keeps the current one. Password reset inserts `INVALIDATE_SESSIONS`, and the worker deletes every session for that user. Deleting a missing session is success.
- Login is limited to 5 failures per email and 20 per IP in 15 minutes. Registration is limited to 5 per IP per hour. Password reset email is limited to 3 per email per hour. GraphQL is limited to 300 requests per minute per IP. The approved text did not give a global number, so 300 is the chosen limit.
- When Redis cannot store a counter, public authentication mutations (`register`, `login`, `requestPasswordReset`, and the other mutations behind the same gate) return `EXTERNAL_UNAVAILABLE` / `auth.rate_limit_unavailable` and do not run. Login and registration counters also fail closed inside the auth service, so a failed login is not reported as invalid credentials when the failure cannot be recorded. Password reset still returns true when Redis answers and the hourly cap is exceeded, and it does not send mail in that case. It does not return true when Redis cannot count the request. GraphQL queries, including `foundationHealth`, still succeed when the global counter cannot be stored. Session middleware still continues an anonymous request when the session store errors. `GET /ready` returns 503. `GET /health` does not call Redis.
- TypeORM error logs omit bound parameters, so a unique-violation log does not include the password hash or the email token. Outbox failure text redacts `token=` query values. `failedOutboxMessages` does not select `payload`.
- Login cannot create a session without Redis. A Redis outage does not bypass the authentication abuse counters.

## Outbox and BullMQ

- The outbox insert uses the database clock: `available_at` is `LEAST(requested timestamp, now())`. A host clock ahead of PostgreSQL cannot hide a due row. This milestone does not schedule a delayed outbox message.
- The poller claims due unpublished rows with `FOR UPDATE SKIP LOCKED`, enqueues with `jobId` equal to the outbox id, and then sets `published_at`. Enqueue failure increments `attempts` and `last_error`. It does not set `published_at`.
- The worker runs the side effect and then sets `processed_at`. A second delivery after `processed_at` does nothing. `SEND_EMAIL` can send the same SMTP message again if it runs before `processed_at`. It does not insert another token row. `INVALIDATE_SESSIONS` deletes the current Redis sessions and does not recreate them.
- Attempts: 5. Backoff is exponential from `OUTBOX_BACKOFF_MS` (default 1000 ms). Completed and failed jobs stay in Redis (`removeOnComplete` and `removeOnFail` are false).
- Startup reconciliation reads unpublished-success rows that are already published and not settled. It marks a job only when two reads agree that it is `failed` or missing. `active`, `waiting`, `delayed`, and `completed` stay unmarked. It does not enqueue. A second scan does not insert a row or overwrite `processed_at`.
- Admin retry locks the failed row, calls `Job.retry()` or enqueues that same id and payload, and only then clears `processing_failed_at`. A failed handoff leaves the failure mark in place. The retry does not pause a worker, insert a row, or change `dedupe_key` or `payload`. If the job is already waiting, delayed, or active, the existing job is the handoff. A completed job is removed and enqueued again with the stored payload, because a completed job is not proof that `processed_at` was written. A worker that receives the job while the failure mark is still set delays it and does not run the side effect. A permanently failed job is not retried by the worker itself. SMTP can still deliver the same message twice when the send succeeds and the process stops before `processed_at`. The token row stays one.
- `CREATE_NOTIFICATION` and `REFRESH_WORK` throw if a row of that type is delivered. They are not implemented.
- BullMQ 6 is constructed with a connected `node-redis` client. Passing a Redis URL makes BullMQ load ioredis, and that connection path blocked the Node.js event loop in this environment, including against a healthy Redis. The API already depends on `redis` 6.3.1. ioredis was not added as a direct dependency.
- SMTP duplicate delivery is expected when the side effect succeeds and the process stops before `processed_at`. The token table still has one row. Mailpit will show two messages in that case.

## Tests and results

Jest unit tests do not need PostgreSQL or Redis. Integration tests create `culturespace_test` from the database in `DATABASE_URL` and use isolated Redis prefixes and the queue name `cs-outbox-test`. They do not call a live mail or object-storage provider. The mail port is replaced in the test application.

Final local results:

| Command                    | Result                                                                                     |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `pnpm format`              | Pass. All matched files use Prettier.                                                      |
| `pnpm lint`                | Pass. API and web ESLint.                                                                  |
| `pnpm typecheck`           | Pass. API `tsc` and web `next typegen` plus `tsc`.                                         |
| `pnpm test`                | Pass. Web 2 suites, 4 tests. API 12 suites, 36 tests.                                      |
| `pnpm test:integration`    | Pass. 3 suites, 24 tests, 22.5 s. `DATABASE_URL` pointed at `127.0.0.1:5433/culturespace`. |
| `pnpm test:e2e`            | Pass. 1 suite, 1 test, 7.8 s. Same PostgreSQL and Redis as integration.                    |
| `pnpm build`               | Pass. API `nest build` and web `next build`.                                               |
| Disposable migration stage | Pass. See `CI_PIPELINE_REPORT.md`. Fresh database `culturespace_migrations` on port 5433.  |

The integration suite covers duplicate and case-insensitive email and username rejection, credential enumeration, verification expiry and single use, session regeneration, idle and absolute expiry, logout and logout-all, password change and reset session removal, role change on the next request, unverified follow, self-follow, idempotent follow, private follower lists, outbox rollback, the Q-22 detach fixture, the register-verify-login-follow journey, empty favorites, and `favorites.catalog_unavailable`. Outbox tests cover permanent failure and admin retry, a requeue that happens before the failure mark is cleared, duplicate SMTP delivery with one token row, repeated session deletion, missed failure events, missing Redis jobs, and unmarked waiting, delayed, active, and completed jobs, plus a second reconciliation scan. Unit tests cover public auth mutations returning `auth.rate_limit_unavailable` when Redis is closed, while `foundationHealth` still returns `ok`. `pnpm test:e2e` repeats the register, verify, login, and follow journey as the GraphQL end-to-end check.

`pnpm migration:show` on the development database shows the identity migration applied.

## Commands executed

From the repository root, with Node.js 24.22.2 and pnpm 12.16.1:

```text
pnpm format:write
pnpm format
pnpm lint
pnpm typecheck
pnpm test -- --forceExit
pnpm test:integration -- --forceExit
pnpm test:e2e -- --forceExit
pnpm build
pnpm migration:prepare
pnpm migration:run
pnpm migration:verify
pnpm migration:run
pnpm migration:show
pnpm migration:verify
```

Integration and end-to-end tests used:

```text
DATABASE_URL=postgresql://culturespace:culturespace@127.0.0.1:5433/culturespace
```

The migration stage used:

```text
DATABASE_URL=postgresql://culturespace:culturespace@127.0.0.1:5433/culturespace_migrations
```

The `docker` client is not on `PATH`. Compose was invoked with `%LOCALAPPDATA%\Programs\DockerDesktop\resources\bin\docker.exe`.

## Docker Compose verification

Client and engine version 29.9.2. The six existing services were already healthy. After the Compose file change:

- `docker compose up -d redis api` recreated Redis and the API. Redis `maxmemory-policy` is `noeviction`.
- The API container ran `pnpm install --frozen-lockfile`. It added 44 packages and built `argon2`. `@swc/core` printed a native-binding warning and fell back toward wasm. The install exited 0. The web container was already running and stayed healthy.
- `GET http://127.0.0.1:4000/ready` returned 200 with PostgreSQL and Redis up.
- `GET http://127.0.0.1:3000/en` returned 200.
- `login` for an unknown account returned `UNAUTHENTICATED` / `auth.invalid_credentials`.
- `register` for `milestone2-mailpit@example.com` succeeded, and Mailpit’s search API returned one message for that recipient. That account now exists in the development database.

The API container uses `SMTP_HOST=mailpit` and signs avatar URLs for `http://host.docker.internal:9000`. Host development defaults remain `127.0.0.1`.

## GitHub Actions status

The first remote run of `3ee836b`, https://github.com/aibek1018/culture-space/actions/runs/41438733810, failed in `quality` because `pnpm typecheck` loads `apps/web/next.config.ts` and that file requires `API_INTERNAL_URL`. The workflow now sets `API_INTERNAL_URL=http://127.0.0.1:4000` for every job. `unit`, `integration`, and `e2e` passed on that run. `migrations` and `build` did not start.

The workflow is three stages: Tests (`quality`, `unit`, `integration`, `e2e`, then the `tests` gate), Migrations, then Build. The stable required check remains `verify`. Triggers are pushes to `main`, pushes to `feature/**`, and pull requests targeting `main`. The integration and end-to-end jobs use PostgreSQL 17 and Redis 7 and set `maxmemory-policy` to `noeviction`. The migration job uses a separate fresh PostgreSQL 17 database named `culturespace_migrations`. Exact commands and local results are in `CI_PIPELINE_REPORT.md`. The branch has not been merged.

## Remaining issues

- Favorite rows cannot be stored until Milestone 3 creates `genres` and `persons`.
- Follow does not emit `CREATE_NOTIFICATION`. Milestone 8 must use the dedupe key documented in `follow-notification.contract.ts` and the column updates in that file.
- `changeUserRole`, `suspendUser`, and `restrictUser` are not implemented. They need `moderation_actions`, which is a later milestone. Restriction enforcement is present for rows that already exist.
- The development database contains the Mailpit verification account `milestone2-mailpit@example.com` / `mailpit_check`.
- `@swc/core` postinstall inside the Linux API container warned about the native binding. The web container was already healthy and was not rebuilt in this session.
- Remote CI has not run on this branch.

## Deviations from the approved architecture

- Favorite junction tables and their foreign keys are intentionally absent. See the staging note above. The GraphQL mutations remain and fail closed for any real catalog id.
- Follower notifications are not created. The unfollow contract for an existing notifications table is implemented and covered by a test-only fixture table. That table is not a migration.
- BullMQ uses a connected `node-redis` client rather than a Redis URL, because the ioredis path blocked the event loop.
- The global GraphQL limit is 300 requests per minute per IP.
- Outbox availability is clamped to the database clock.
- GraphQL queries and session loading fail open when Redis cannot be reached, so liveness and the temporary health query still respond. GraphQL mutations fail closed in that case. Readiness does not fail open.
- TypeORM’s error logger no longer prints query parameters.

No JWT authentication, Prisma, REST auth API, catalog client, or Milestone 3 table was introduced.

## Acceptance checklist

| Criterion                                                             | Result                                                                                                                                                  |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrations apply from a clean database                                | PASS. `culturespace_test` is created empty and migrated by the integration run. The development database shows `[X] CreateIdentityTables1730563200000`. |
| Database constraints are enforced and tested                          | PASS                                                                                                                                                    |
| Registration, verification, login, and recovery work through GraphQL  | PASS                                                                                                                                                    |
| Redis sessions match the approved lifetimes and regeneration          | PASS                                                                                                                                                    |
| Password reset invalidates sessions                                   | PASS                                                                                                                                                    |
| Email delivery works through Mailpit                                  | PASS. One registration email arrived in Mailpit.                                                                                                        |
| Public account queries do not expose private fields                   | PASS                                                                                                                                                    |
| Unverified users cannot follow                                        | PASS                                                                                                                                                    |
| Self-follow and duplicate follow constraints                          | PASS                                                                                                                                                    |
| Outbox handoff, permanent failure, reconciliation, and admin recovery | PASS                                                                                                                                                    |
| Security and privacy tests                                            | PASS                                                                                                                                                    |
| TypeScript, lint, format, unit tests, integration tests, and builds   | PASS                                                                                                                                                    |
| Docker Compose continues to work                                      | PASS. Six services healthy after recreating Redis and the API. `/ready` returned 200.                                                                   |
| CI remains green                                                      | NOT VERIFIED. No remote run for this branch.                                                                                                            |
| No Milestone 3 or later business functionality                        | PASS                                                                                                                                                    |
| Favorite genre and person persistence                                 | Documented boundary. Tables are not created. Empty selections succeed. Non-empty selections return `favorites.catalog_unavailable`.                     |
| Role and restriction mutations that require moderation actions        | Not implemented, by milestone boundary. Enforcement of existing restriction rows is present.                                                            |
