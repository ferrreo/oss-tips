# oss.tips

Open-source project support and membership platform.

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io/) 10+
- Docker (for local Postgres and optional RustFS/TigerBeetle)

## Quick start

```bash
pnpm install
cp .env.example .env

# Start infrastructure
docker compose -f infra/docker/docker-compose.yml up -d postgres

# Optional object storage
docker compose -f infra/docker/docker-compose.yml --profile storage up -d rustfs
pnpm storage:bootstrap

# Local ledger
docker compose -f infra/docker/docker-compose.yml --profile ledger up -d tigerbeetle

# Build shared packages
pnpm -r --filter=./packages/* build

# Run database migrations
pnpm db:migrate

# Start the web app
pnpm dev:web
```

The web app runs at [http://localhost:3000](http://localhost:3000).

The example environment uses `LEDGER_MODE=mock` for local development. To run
the finance worker against local TigerBeetle, set `LEDGER_MODE=tigerbeetle`,
`TIGERBEETLE_ADDRESSES=127.0.0.1:3000`, and `TIGERBEETLE_CLUSTER_ID=0`.
Cluster `0` and the single-replica container are development settings only.

## Scripts

| Command                                 | Description                                             |
| --------------------------------------- | ------------------------------------------------------- |
| `pnpm dev:web`                          | SvelteKit dev server (`@oss-tips/web`)                  |
| `pnpm storybook` / `pnpm dev:storybook` | Storybook for every UI page + components (:6006)        |
| `pnpm build-storybook`                  | Static Storybook build (`packages/ui/storybook-static`) |
| `pnpm dev:worker`                       | Background job worker                                   |
| `pnpm dev:finance`                      | Finance worker (Stripe event inbox loop)                |
| `pnpm dev:discord`                      | Discord bot process                                     |
| `pnpm db:migrate`                       | Apply Postgres migrations                               |
| `pnpm db:seed`                          | Seed development data                                   |
| `pnpm check:backup-restore`             | Verify a disposable Postgres backup and restore         |
| `pnpm check:tigerbeetle-replay`         | Replay the financial drill corpus on an isolated ledger |
| `pnpm build`                            | Build all packages and apps                             |
| `pnpm typecheck`                        | Typecheck the monorepo                                  |
| `node scripts/smoke-tigerbeetle.mjs`    | CI infrastructure check for a configured TigerBeetle    |

## Apps

### Web (`apps/web`)

Routes wire thin `+page.svelte` files to page compositions from `@oss-tips/ui`. Design-system CSS (Paperlight tokens) loads from `@oss-tips/design-tokens/css`.

API routes:

- `GET /api/v1/health`
- `GET /api/v1/projects` (from Postgres when `DATABASE_URL` is set)
- `POST /api/v1/projects/:slug/checkout` (creates Stripe Checkout intent + pending payment)
- `POST /api/webhooks/stripe` (signed durable inbox into `stripe_event`)
- `/api/auth/[...all]` (Better Auth handler when database is configured)

Operational endpoints:

- `GET /healthz` for process liveness without a database call
- `GET /readyz` for database readiness; returns `503` until Postgres responds
- `GET /api/v1/health` remains available for API clients

### Workers

- `apps/worker` — general job queue consumer
- `apps/finance-worker` — claims unprocessed `stripe_event` rows and processes them
- `apps/discord-bot` — Discord role reconciliation bot

Start workers after Postgres is available and `DATABASE_URL` is set in `.env`.
General worker consumes `default`, `exports`, and `domains` queues by default;
override with comma-separated `WORKER_QUEUE` values when running dedicated
workers.
Production compose runs a separate `otp-worker` with `WORKER_QUEUE=otp`; it
claims only authentication mail and does not run general outbox/webhook
dispatch work.
The finance worker also requires `TIGERBEETLE_ADDRESSES` and
`TIGERBEETLE_CLUSTER_ID` in production. It fails closed when either setting is
missing.

## Production containers and telemetry

`infra/docker/Dockerfile.worker` builds the general worker, OTP worker, finance
worker, and Discord bot from one image. `APP_FILTER` selects app. The
production compose file wires all application processes to an on-host
OpenTelemetry Collector:

```bash
docker compose -f infra/docker/docker-compose.production.yml up -d --build
```

Set `MAPLE_OTLP_ENDPOINT` and `MAPLE_OTLP_TOKEN` in deployment secrets before
starting compose. App processes use `OTEL_EXPORTER_OTLP_ENDPOINT` and
`OTEL_EXPORTER_OTLP_PROTOCOL=http/protobuf`; `OTEL_EXPORTER_OTLP_HEADERS` takes
comma-separated `name=value` pairs. Leave the endpoint empty to keep telemetry
disabled in local development. Export failures do not stop requests or workers.

The collector configuration is
[infra/otel/collector.yaml](infra/otel/collector.yaml). It removes
credentials, bodies, query strings, database text, email, payment, and project
identifiers before export. No Maple token belongs in the repo.

## Storybook

Theme toolbar switches light and dark via `data-theme`.

```bash
pnpm storybook          # http://localhost:6006
pnpm build-storybook    # packages/ui/storybook-static
```

Coverage includes all route-facing compositions used by `apps/web` (home, explore, project support, dashboards, admin, legal docs, claim/reply, etc.).

## Local infrastructure

`infra/docker/docker-compose.yml` provides:

- **postgres** — primary database (port 5432)
- **rustfs** (optional profile) — official RustFS S3-compatible object storage (ports 9000/9001). `pnpm storage:bootstrap` creates the five named buckets idempotently.
- **tigerbeetle** (optional profile) — TigerBeetle 0.17.9 development replica used by local ledger adapter

## Project layout

```text
apps/
  web/              SvelteKit site
  worker/           Job worker
  finance-worker/   Stripe + ledger worker
  discord-bot/      Discord integration
packages/
  ui/               Page compositions + components
  db/               Postgres schema and repositories
  domain/           Core domain types
  ...
infra/docker/       Local development services
```

## License

BSD-3-Clause — see [LICENSE](./LICENSE).
