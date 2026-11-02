# CI Pipeline Report

The workflow file is `.github/workflows/ci.yml`. It does not deploy and it does not merge.

## Job graph

```text
push main
push feature/**
pull_request -> main
        |
        +-- quality
        +-- unit
        +-- integration
        +-- e2e
                |
                v
              tests
                |
                v
           migrations
                |
                v
              build
                |
                v
             verify
```

`quality`, `unit`, `integration`, and `e2e` start together. `tests` is the Tests stage gate and runs only after those four finish. `migrations` runs only after `tests` succeeds. `build` runs only after `migrations` succeeds. `verify` always runs and succeeds only when `tests`, `migrations`, and `build` all succeeded.

The branch-protection check to require is `verify`. GitHub shows it as `CI / verify`.

## Triggers

| Event          | Branches             |
| -------------- | -------------------- |
| `push`         | `main`, `feature/**` |
| `pull_request` | `main`               |

`feature/milestone-2-auth-users` matches `feature/**`. A pull request into a branch other than `main` does not start this workflow. A push to a branch outside `main` and `feature/**` does not start it.

Pull-request runs in one concurrency group cancel the older run for that ref. Pushes are not cancelled.

## Tests stage

| Job           | Command                                                              | Services               |
| ------------- | -------------------------------------------------------------------- | ---------------------- |
| `quality`     | `pnpm format`, `pnpm lint`, `pnpm typecheck`                         | none                   |
| `unit`        | `pnpm test`                                                          | none                   |
| `integration` | Redis `maxmemory-policy=noeviction`, then `pnpm test:integration`    | PostgreSQL 17, Redis 7 |
| `e2e`         | Redis `maxmemory-policy=noeviction`, then `pnpm test:e2e`            | PostgreSQL 17, Redis 7 |
| `tests`       | requires `quality`, `unit`, `integration`, and `e2e` to be `success` | none                   |

Every job installs with `pnpm install --frozen-lockfile`, Node.js from `.node-version` (24.22.2), and pnpm 12.16.1. Integration and end-to-end tests create `culturespace_test` and replace the mail port. They do not call Mailpit or a live object store.

`pnpm test:e2e` runs `apps/api/test/graphql.e2e-spec.ts`: register, verify email, login, and follow.

## Migrations stage

`migrations` depends on `tests`. It starts a new PostgreSQL 17 service and does not reuse the test database.

1. `pnpm migration:prepare` drops and creates `culturespace_migrations`. It refuses `culturespace`, `culturespace_test`, `postgres`, `template0`, and `template1`.
2. `pnpm migration:run` must execute `CreateIdentityTables1730563200000` and must not report `No migrations are pending`.
3. `pnpm migration:verify` requires `synchronize: false`, the identity tables, checks, unique indexes, `pg_trgm`, `unaccent`, cascade deletes on `follows`, restrict deletes on `user_restrictions`, and exactly one row in `typeorm_migrations`. `genres`, `persons`, `user_favorite_genres`, and `user_favorite_persons` must be absent.
4. `pnpm migration:run` a second time must report `No migrations are pending`.
5. `pnpm migration:show` must show `[X] 1 CreateIdentityTables1730563200000` and no `[ ]` line.

## Build stage

`build` depends on `migrations` and runs `pnpm build`.

## Local verification

Node.js 24.22.2 and pnpm 12.16.1, from the repository root. PostgreSQL was the Compose instance on `127.0.0.1:5433`. Redis was `127.0.0.1:6379`.

| Command                                | Result                                                |
| -------------------------------------- | ----------------------------------------------------- |
| `pnpm format`                          | Pass. All matched files use Prettier.                 |
| `pnpm lint`                            | Pass. API and web ESLint.                             |
| `pnpm typecheck`                       | Pass. API `tsc` and web `next typegen` plus `tsc`.    |
| `pnpm test -- --forceExit`             | Pass. Web 2 suites, 4 tests. API 12 suites, 36 tests. |
| `pnpm test:integration -- --forceExit` | Pass. 3 suites, 24 tests, 22.5 s.                     |
| `pnpm test:e2e -- --forceExit`         | Pass. 1 suite, 1 test, 7.8 s.                         |
| `pnpm build`                           | Pass. API `nest build` and web `next build`.          |

Migration commands used `DATABASE_URL=postgresql://culturespace:culturespace@127.0.0.1:5433/culturespace_migrations`.

| Step                           | Result                                                                                                                                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm migration:prepare`       | Pass. Exit 0. Recreated `culturespace_migrations`.                                                                                                                                                                                                 |
| First `pnpm migration:run`     | Pass. `0 migrations are already loaded in the database.` `1 migrations are new migrations must be executed.` `Migration CreateIdentityTables1730563200000 has been executed successfully.` The output did not contain `No migrations are pending`. |
| First `pnpm migration:verify`  | Pass. Exit 0.                                                                                                                                                                                                                                      |
| Second `pnpm migration:run`    | Pass. `No migrations are pending`.                                                                                                                                                                                                                 |
| `pnpm migration:show`          | Pass. `[X] 1 CreateIdentityTables1730563200000`. No pending `[ ]` line.                                                                                                                                                                            |
| Second `pnpm migration:verify` | Pass. Exit 0. The schema and the single migration row were unchanged.                                                                                                                                                                              |

The development database `culturespace` was not dropped or migrated by this check.

## Remote status

NOT VERIFIED. This correction was not pushed, and no GitHub Actions run was observed. The branch was not merged into `main`.
