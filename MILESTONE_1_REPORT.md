# Milestone 1 Report — Foundation

Date: 2026-11-02

Architecture baseline: version 0.4, unchanged.

Final status: **COMPLETE**. The remote GitHub Actions run on commit `4a0d9cd` succeeded. Milestone 2 was not started.

## 1. Implemented infrastructure

- pnpm workspace with `apps/api` and `apps/web`. No shared runtime package. GraphQL remains the contract between the applications.
- NestJS 12 API compiled to CommonJS. Strict TypeScript. Zod environment validation rejects missing and malformed required variables at application initialization.
- TypeORM 0.3.31 `DataSource` for PostgreSQL. `synchronize: false` is hardcoded. The migrations directory exists and is empty. No product entities or tables.
- Redis client and `express-session` with `connect-redis`, mounted only on `/graphql`. Cookie name `cs.sid`, HttpOnly, `SameSite=Lax`, `Secure` in production, idle lifetime 14 days, Redis prefix `cs:sess:`. Login, registration, session regeneration, revocation, and the 30-day absolute lifetime are not implemented. They belong to Milestone 2.
- GraphQL Code First on `/graphql`. The only operation is the temporary query `foundationHealth`, which returns `"ok"`. It is scaffolding and must be removed before production. It is not part of `GRAPHQL_API.md`.
- `GET /health` reports process liveness and does not call PostgreSQL or Redis. `GET /ready` returns 200 only when both dependencies answer and 503 otherwise. Response bodies do not include connection strings or stack traces.
- Structured pino logging with cookie, authorization, and secret redaction. Graceful shutdown hooks are enabled.
- Next.js shell with Tailwind CSS, English and Russian routes `/en` and `/ru`, and a language switcher. No product screens and no Apollo Client.
- Docker Compose definition for PostgreSQL 17, Redis 7, MinIO, Mailpit, the API, and the web shell. Ports are bound to `127.0.0.1`.
- GitHub Actions workflow for install, lint, typecheck, unit tests, integration tests, and production builds. No image publish and no deployment.

The API process stays up when PostgreSQL or Redis is down, so `/ready` can return 503. The `DataSource` is created directly for that reason. `TypeOrmModule.forRoot` is not used, because it aborts startup when the database is unreachable.

## 2. Repository structure

```text
cultureSpace/
  apps/
    api/          NestJS API
    web/          Next.js shell
  docker/
    api/Dockerfile
    web/Dockerfile
    dev-entrypoint.sh
  .github/workflows/ci.yml
  docker-compose.yml
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  .env.example
  .node-version
  .nvmrc
  README.md
  MILESTONE_1_REPORT.md
```

Backend source layout:

```text
apps/api/src/
  common/                 .gitkeep
  config/                 Zod schema and typed configuration
  database/               DataSource, connection, empty migrations/
  infrastructure/         logger, redis, session
  integrations/           .gitkeep
  modules/                .gitkeep
  health/                 /health, /ready, temporary GraphQL query
  app.module.ts
  configure-app.ts
  main.ts
```

`common`, `integrations`, and `modules` contain no business code.

## 3. Files created or modified

Created: the workspace, both applications, Docker and CI files, `.env.example`, `.gitignore`, `.gitattributes`, `.dockerignore`, `README.md`, and this report.

Approved documents were not rewritten. `DEVELOPMENT_PLAN.md` gained one implementation-status paragraph under Milestone 1 that points at this report. `PROJECT_SPEC.md`, `ARCHITECTURE.md`, `DATABASE.md`, `GRAPHQL_API.md`, and `ARCHITECTURE_REVIEW.md` were not modified.

No user, catalog, library, review, club, feed, notification, outbox, or authentication module was added.

## 4. Dependencies and selected versions

Versions are exact in the package manifests and pinned by `pnpm-lock.yaml`. Production dependencies do not use ranges.

Runtime:

- Node.js 24.22.2 (`.node-version` and `.nvmrc`)
- pnpm 12.16.1

API:

- NestJS `12.3.2` (`common`, `core`, `platform-express`, `testing`)
- `@nestjs/cli` and `@nestjs/schematics` `12.0.11`
- `@nestjs/config` `12.0.1`
- `@nestjs/graphql` `14.1.0`, `@nestjs/apollo` `14.1.1`
- `@apollo/server` `5.5.1`, `@as-integrations/express5` `1.1.2`, `graphql` `16.14.2`
- `typeorm` `0.3.31`, `pg` `8.23.1`
- `redis` `6.3.1`, `connect-redis` `10.0.0`, `express-session` `1.19.0`
- `zod` `4.6.7`
- `nestjs-pino` `5.3.1`, `pino` `10.4.0`, `pino-http` `11.0.0`, `pino-pretty` `13.2.0`
- `class-validator` `0.15.1`, `class-transformer` `0.5.1`, `reflect-metadata` `0.2.2`, `rxjs` `7.8.2`

Web:

- `next` `16.4.3`, `react` and `react-dom` `19.3.1`
- `next-intl` `4.14.9`
- `tailwindcss` and `@tailwindcss/postcss` `4.3.3`

Tooling:

- TypeScript `6.0.3`
- ESLint `9.39.5`, `typescript-eslint` `8.72.1`, `eslint-config-prettier` `10.1.8`, `eslint-config-next` `16.4.3`
- Prettier `3.9.10`
- Jest `30.5.2`, `ts-jest` `29.4.15`, `supertest` `7.3.1`
- `@types/node` `24.19.2`

Compatibility choices:

- Node.js 24 is the selected runtime. The Node.js 22 fallback was not used. NestJS 12 declares `engines.node` `>=20`.
- TypeORM stays on `0.3.31`. The current npm major is outside the approved 0.3.x line.
- TypeScript stays on `6.0.3`. The NestJS GraphQL peer range is `^5.5 || ^6`. API `tsconfig` sets `ignoreDeprecations` to `6.0` and keeps CommonJS with Node module resolution so existing import paths do not need `.js` extensions.
- NestJS 12 packages are ESM. The API build remains CommonJS, which Node.js 24 loads. Jest is started with `--experimental-vm-modules` because that is what lets Jest load those ESM packages. The VM Modules experimental warning is expected.
- `connect-redis` 10 is ESM. The session middleware loads it with a dynamic `import()`.
- pnpm 12 requires explicit approval for dependency build scripts. `pnpm-workspace.yaml` allows builds for `@apollo/protobufjs`, `@parcel/watcher`, and `@swc/core`.
- `@nestjs/typeorm`, Apollo Client, ioredis, BullMQ, and GraphQL codegen are not installed. This milestone does not need them.

## 5. Commands executed

Node.js 24.22.2 was placed first on `PATH` for every command. The system Node.js on this machine is 22.14.0 and was not used.

Final sweep, all with exit code 0:

- `pnpm install --frozen-lockfile`
- `pnpm typecheck`
- `pnpm lint`
- `pnpm test`
- `pnpm format` (`prettier --check .`)
- `pnpm build`

Earlier in the same implementation, with exit code 0 unless noted:

- `pnpm install` (created `pnpm-lock.yaml`)
- API `nest build` and web `next build`
- Built API process: `node apps/api/dist/main.js` with PostgreSQL and Redis pointed at `127.0.0.1:1`
- `GET /health`, `GET /ready`, and `POST /graphql` against that process
- `next start` and browser checks of `/en` and `/ru` on desktop and a 390px-wide viewport
- `pnpm test:integration` against the Compose PostgreSQL and Redis services, 3 tests passed

## 6. Tests and outcomes

Executed after the final source edits.

| Command                   | Result                         |
| ------------------------- | ------------------------------ |
| `pnpm test` in `apps/api` | 5 suites, 21 tests, all passed |
| `pnpm test` in `apps/web` | 2 suites, 4 tests, all passed  |
| `pnpm test:integration`   | 1 suite, 3 tests, all passed   |

API unit coverage that actually ran:

1. Missing required environment variables are rejected.
2. Malformed required values are rejected, including a non-PostgreSQL URL, a short session secret, and the development session secret when `NODE_ENV=production`.
3. The NestJS application starts with a valid configuration while both dependencies are unreachable.
4. `GET /health` returns 200 and `{ "status": "ok" }` without a successful database or Redis call.
5. `GET /ready` returns 503 when both closed ports refuse connections. The body is `{ "status": "unavailable", "checks": { "postgres": "down", "redis": "down" } }` and does not contain the connection strings.
6. TypeORM options set `synchronize` to `false`. The booted `DataSource` also reports `synchronize === false`.
7. GraphQL Code First answers `{ foundationHealth }` with `"ok"` and does not set the `cs.sid` cookie on that request.
8. Session cookie options are HttpOnly, `SameSite=Lax`, and `Secure` only in production.

Web unit coverage that actually ran:

- The placeholder renders the English and Russian strings passed into it.
- English and Russian message catalogs have the same keys, including the title `CULTURE SPACE` and both status sentences.

`pnpm test:integration` ran against the Compose services (`127.0.0.1:5433` and `127.0.0.1:6379`), not mocks. All 3 tests passed:

- `GET /ready` returns 200 when PostgreSQL and Redis both respond, `synchronize` is false, the `DataSource` is initialized, and a session payload is written, read, and destroyed through `connect-redis`.
- `GET /ready` returns 503 with `postgres: down` and `redis: up` when PostgreSQL is pointed at a closed port.
- `GET /ready` returns 503 with `postgres: up` and `redis: down` when Redis is pointed at a closed port.

The response bodies do not contain connection strings.

## 7. Docker Compose verification

**PASS**, observed on 2026-11-02.

Docker Desktop 4.97.0 is installed at `%LOCALAPPDATA%\Programs\DockerDesktop`. The `docker` client is not on the default `PATH`. The engine was reached with `resources\bin\docker.exe`. Client and engine version 29.9.2.

`docker compose up --build -d` exited 0. `docker compose ps` then showed all six services healthy:

| Service       | Result                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------ |
| PostgreSQL 17 | healthy, published on `127.0.0.1:5433` because a local `postgres` process already owned port 5432      |
| Redis 7       | healthy on `127.0.0.1:6379`                                                                            |
| MinIO         | healthy; `GET http://127.0.0.1:9000/minio/health/live` returned 200                                    |
| Mailpit       | healthy; `GET http://127.0.0.1:8025` returned 200                                                      |
| API           | healthy; `GET /health` 200, `GET /ready` 200 with both checks `up`, `foundationHealth` returned `"ok"` |
| Web           | healthy; `GET /en` and `GET /ru` returned 200                                                          |

`minio/minio` cannot be pulled: Docker Hub returns `pull access denied`, and `quay.io/minio/minio` returns 401 for anonymous pulls. Compose uses the public Chainguard MinIO image `cgr.dev/chainguard/minio` pinned to digest `sha256:0a01100085e30fb08d2f39e39c9f5c9d83a95707f220b007d813b690cd41622d` (RELEASE.2026-10-23T20-06-51Z). The server command and `MINIO_ROOT_*` variables are unchanged.

The dev entrypoint starts as root only to give the named `node_modules` volumes to the `node` user, then continues with `setpriv`. `HOME` and `COREPACK_HOME` point at `/home/node`, so pnpm does not read root-owned config.

## 8. Build, lint, and type-check results

Final sweep on Node.js 24.22.2, all exit code 0:

- `pnpm typecheck` — API `tsc --noEmit` and web `next typegen && tsc --noEmit`
- `pnpm lint` — API and web ESLint
- `pnpm format` — Prettier check, including this report after formatting
- `pnpm build` — `nest build` and `next build`

The web production build prerendered `/en` and `/ru`. The generated HTML contains `CULTURE SPACE`, `The application foundation is running.` for English, and `Фундамент приложения запущен.` for Russian.

Browser verification, before the last production rebuild, on `http://127.0.0.1:3000`:

- `/en` showed the English foundation status. Activating the Russian link opened `/ru` with the Russian status and the language label `Язык`.
- Activating the English link returned to `/en`.
- A 390×844 viewport stacked the language controls. A 1280×900 viewport kept the page centered with the controls in a row.

The last source change routes those links through `next-intl` `getPathname` and then `next build` succeeded. The browser was not driven again after that rebuild. The generated locale pages still contain the same status copy.

## 9. CI configuration and verification status

`.github/workflows/ci.yml` is configured for pushes to `main` and for pull requests. The job uses Node.js 24.22.2, pnpm 12.16.1, `pnpm install --frozen-lockfile`, lint, typecheck, unit tests, integration tests, and production builds. PostgreSQL 17 and Redis 7 are GitHub Actions service containers. The workflow does not deploy and does not publish images.

**Remote CI passed.** The repository is https://github.com/aibek1018/culture-space. Commit `4a0d9cd77ab55d29e52a977287dd1247608f8a0a` is `origin/main`. The workflow run https://github.com/aibek1018/culture-space/actions/runs/41417777084 completed with conclusion `success` on 2026-11-02. That run installs from a fresh checkout with `pnpm install --frozen-lockfile`. The job log was not opened line by line; the result comes from the GitHub Actions API.

## 10. Acceptance checklist

| Criterion                                                  | Result                                                                                                                         |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| A clean checkout can install dependencies                  | PASS — the GitHub Actions run installed this commit from a fresh checkout with `pnpm install --frozen-lockfile` and succeeded. |
| The pnpm workspace is valid                                | PASS                                                                                                                           |
| NestJS builds and starts                                   | PASS — `nest build` succeeded and the built process logged a successful start.                                                 |
| Next.js builds and renders the bilingual placeholder       | PASS — production build plus browser EN/RU navigation.                                                                         |
| PostgreSQL and Redis connect successfully                  | PASS — `GET /ready` returned 200 from the Compose stack, and the integration suite connected to both.                          |
| Redis-backed session middleware is configured              | PASS — cookie options in unit tests, and a `connect-redis` write, read, and delete in the integration test.                    |
| TypeORM DataSource is configured                           | PASS                                                                                                                           |
| TypeORM `synchronize` remains false                        | PASS — asserted in unit tests.                                                                                                 |
| GraphQL Code First infrastructure starts                   | PASS — `foundationHealth` returned `"ok"` from the running API.                                                                |
| `GET /health` works                                        | PASS — HTTP 200.                                                                                                               |
| `GET /ready` reports actual PostgreSQL and Redis readiness | PASS — 200 when both are up; 503 when either one is down; 503 when both are down.                                              |
| Docker Compose starts the local development stack          | PASS — `docker compose up --build -d` exited 0 and all six services became healthy.                                            |
| MinIO and Mailpit start successfully                       | PASS — both containers healthy; MinIO live check and the Mailpit UI returned 200.                                              |
| Strict TypeScript checks pass                              | PASS                                                                                                                           |
| ESLint checks pass                                         | PASS                                                                                                                           |
| Tests pass                                                 | PASS — API unit 21, web unit 4, integration 3.                                                                                 |
| Root build commands pass                                   | PASS                                                                                                                           |
| GitHub Actions workflow is configured                      | PASS — run 41417777084 on commit `4a0d9cd` completed with conclusion `success`.                                                |
| README documents local setup                               | PASS                                                                                                                           |
| No Milestone 2 business functionality was implemented      | PASS                                                                                                                           |

## 11. Remaining issues and environment limitations

- The `docker` client is not on the default `PATH`. Docker Desktop 4.97.0 is installed under the user profile, and the engine was running.
- Host port 5432 is already taken by a local `postgres` process. This machine's `.env` publishes Compose PostgreSQL on `5433`. The database inside the Compose network stays on 5432.
- The system Node.js is 22.14.0. Commands used a portable Node.js 24.22.2. The project itself requires Node.js 24.
- Jest prints `ExperimentalWarning: VM Modules` because of `--experimental-vm-modules`.
- `foundationHealth` is temporary scaffolding and must be removed before production.

## 12. Architectural deviations

No approved decision from architecture version 0.4 was changed. The object store is still MinIO.

The image source changed because the official images can no longer be pulled anonymously. `minio/minio` was removed from Docker Hub, and `quay.io/minio/minio` returns 401. Local Compose pins `cgr.dev/chainguard/minio@sha256:0a01100085e30fb08d2f39e39c9f5c9d83a95707f220b007d813b690cd41622d`.

Other choices inside the approved baseline:

- The `DataSource` is owned by the application instead of `TypeOrmModule.forRoot`, so a down database does not prevent `/ready` from answering.
- `node-redis` is used for the session client. ioredis and BullMQ wait for the milestones that need them.
- `@nestjs/typeorm` is not installed because there are no entities yet.
- Apollo Client and a shared UI package were not added.
- TypeScript 6.0.3 is used with `ignoreDeprecations: "6.0"` because the approved NestJS GraphQL peer range does not include TypeScript 7.

## 13. Final milestone status

**COMPLETE**

Local checks and the published GitHub Actions run on commit `4a0d9cd` passed. Milestone 2 was not started.

## Closing summary

Implemented: the pnpm workspace, NestJS API foundation, Next.js bilingual shell, TypeORM configuration with `synchronize: false`, Redis session middleware, GraphQL Code First with one temporary health query, `/health` and `/ready`, Compose and CI definitions, strict TypeScript, ESLint, Prettier, and the foundation tests.

Tested: environment validation, application boot, `/health`, `/ready` with both dependencies up, with one down, and with both down, `synchronize: false`, GraphQL initialization, a `connect-redis` round trip, the bilingual placeholder, lint, typecheck, unit tests, integration tests, production builds, and `docker compose up --build`.

Unresolved: nothing that blocks Milestone 1. `foundationHealth` remains temporary scaffolding and must be removed before production.

Milestone 1 meets its acceptance criteria. Milestone 2 was not started.
