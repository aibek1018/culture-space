# CULTURE SPACE

Milestone 1 foundation for the CULTURE SPACE modular monolith. This repository contains a NestJS API, a Next.js shell, and a local Docker Compose stack. Product features such as accounts, catalog, library, reviews, and clubs are not implemented.

The approved architecture is version 0.4. This milestone does not change it.

## Requirements

- Node.js 24.22.2 LTS. See `.node-version`.
- pnpm 12.16.1, installed with Corepack (`corepack enable` and `corepack prepare pnpm@12.16.1 --activate`).
- Docker Engine with the Compose plugin, for the local stack.

Node.js 22 was not required. NestJS 12, TypeORM 0.3.31, and the Redis session client run on Node.js 24.

## Install

From a clean checkout:

```bash
corepack enable
corepack prepare pnpm@12.16.1 --activate
pnpm install --frozen-lockfile
cp .env.example .env
```

`.env.example` contains local development values only. Do not put production secrets in it.

## Run on the host

PostgreSQL 17 and Redis 7 must already be reachable at the URLs in `.env`.

```bash
pnpm dev:api
pnpm dev:web
```

- Web shell: `http://localhost:3000` (English at `/en`, Russian at `/ru`)
- API: `http://127.0.0.1:4000`
- GraphQL: the web app proxies `/graphql` to the API so the session cookie can stay on the web origin

`GET /health` reports that the process is up. `GET /ready` returns 200 only when both PostgreSQL and Redis answer, and 503 otherwise. Responses do not include connection strings.

## Run with Docker Compose

```bash
cp .env.example .env
docker compose up --build
```

Compose starts PostgreSQL 17, Redis 7, MinIO, Mailpit, the API, and the web shell. Published ports bind to `127.0.0.1`. Inside the Compose network the API uses the `postgres` and `redis` hostnames. The web container uses `http://api:4000` for the GraphQL proxy.

MinIO is the public Chainguard build `cgr.dev/chainguard/minio`, pinned by digest in `docker-compose.yml`. The Docker Hub repository `minio/minio` and anonymous pulls of `quay.io/minio/minio` are no longer available. The server command and `MINIO_ROOT_*` variables are unchanged.

| Service       | Local URL             |
| ------------- | --------------------- |
| Web           | http://127.0.0.1:3000 |
| API           | http://127.0.0.1:4000 |
| MinIO API     | http://127.0.0.1:9000 |
| MinIO console | http://127.0.0.1:9001 |
| Mailpit UI    | http://127.0.0.1:8025 |
| Mailpit SMTP  | 127.0.0.1:1025        |

The API does not connect to MinIO or Mailpit in this milestone. They are started so later milestones can use the same stack.

PostgreSQL and Redis are published only on the loopback interface for local development. The production Compose file, which does not publish them, belongs to Milestone 12.

The first container start installs dependencies into Docker volumes and can take several minutes. Later starts reuse those volumes. Rebuild with `docker compose up --build` after dependency changes.

## Database migrations

TypeORM is configured with `synchronize: false` in every environment. The migrations directory is `apps/api/src/database/migrations`. No product tables are created in this milestone.

From `apps/api`, with a valid `DATABASE_URL`:

```bash
pnpm migration:show
pnpm migration:run
```

## Checks

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm build
pnpm format
```

`pnpm test` does not need PostgreSQL or Redis. It covers environment validation, the disabled TypeORM synchronize flag, session cookie flags, process startup, `GET /health`, `GET /ready` when both dependencies are down, and the temporary GraphQL query.

`pnpm test:integration` needs the real services from `.env` or from the environment. It checks:

- `GET /ready` returns 200 when PostgreSQL and Redis both respond
- `GET /ready` returns 503 when only PostgreSQL is down
- `GET /ready` returns 503 when only Redis is down
- a session payload can be stored and read through `connect-redis`

GitHub Actions runs the same install, lint, typecheck, unit tests, integration tests, and production builds. The workflow is `.github/workflows/ci.yml`. It does not deploy.

## Temporary GraphQL query

`foundationHealth` exists only to prove that GraphQL Code First generates a schema. It is not part of the product contract in `GRAPHQL_API.md`. Remove `FoundationHealthResolver` before production.

Session middleware is mounted on `/graphql` only. It stores session data in Redis with an HttpOnly, `SameSite=Lax` cookie named `cs.sid`. The cookie is `Secure` in production. Login, registration, session regeneration, and the 30-day absolute lifetime are Milestone 2. The idle lifetime configured here is 14 days.

## Troubleshooting

- The API exits immediately with `Invalid environment`. Compare the process environment with `.env.example`. Production rejects the sample `SESSION_SECRET` and requires `https` for `APP_ORIGIN`.
- `GET /ready` returns 503. PostgreSQL or Redis is not accepting connections at `DATABASE_URL` or `REDIS_URL`. The response body names the dependency as `down` and does not include the URL.
- `docker compose up` fails with `bind: An attempt was made to access a socket` on port 5432. Another PostgreSQL is already listening there. Set `POSTGRES_PORT` to a free port, such as `5433`, and point `DATABASE_URL` at that same host port. The database inside the Compose network stays on port 5432.
- The web build fails with `API_INTERNAL_URL is required`. Set that variable. Use `http://127.0.0.1:4000` on the host and `http://api:4000` in Compose.
- Jest prints `ExperimentalWarning: VM Modules`. NestJS 12 publishes ESM. The API tests run Jest on Node.js 24 with `--experimental-vm-modules` so those packages can load. The warning is expected.
- `pnpm install` stops with `ERR_PNPM_IGNORED_BUILDS`. `pnpm-workspace.yaml` already allows the build scripts this milestone needs. Run `pnpm install` again from a current checkout.
- Docker Compose is slow on the first boot. Wait for the API health check. `start_period` allows time for `pnpm install` inside the containers.
