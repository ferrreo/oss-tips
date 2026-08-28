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

# Optional ledger placeholder
docker compose -f infra/docker/docker-compose.yml --profile ledger up -d tigerbeetle

# Build shared packages
pnpm -r --filter=./packages/* build

# Run database migrations
pnpm db:migrate

# Start the web app
pnpm dev:web
```

The web app runs at [http://localhost:3000](http://localhost:3000).

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev:web` | SvelteKit dev server (`@oss-tips/web`) |
| `pnpm storybook` / `pnpm dev:storybook` | Storybook for every UI page + components (:6006) |
| `pnpm build-storybook` | Static Storybook build (`packages/ui/storybook-static`) |
| `pnpm dev:worker` | Background job worker |
| `pnpm dev:finance` | Finance worker (Stripe event inbox loop) |
| `pnpm dev:discord` | Discord bot process |
| `pnpm db:migrate` | Apply Postgres migrations |
| `pnpm db:seed` | Seed development data |
| `pnpm build` | Build all packages and apps |
| `pnpm typecheck` | Typecheck the monorepo |

## Apps

### Web (`apps/web`)

SvelteKit application with `adapter-node`. Routes wire thin `+page.svelte` files to page compositions from `@oss-tips/ui`. Paperlight CSS is loaded from `@oss-tips/design-tokens/css`.

API stubs:

- `GET /api/v1/health`
- `GET /api/v1/projects`
- `POST /api/webhooks/stripe` (durable inbox stub)
- `/api/auth/[...all]` (Better Auth mount stub)

### Workers

- `apps/worker` — general job queue consumer
- `apps/finance-worker` — claims unprocessed `stripe_event` rows and processes them
- `apps/discord-bot` — Discord role reconciliation bot

Start workers after Postgres is available and `DATABASE_URL` is set in `.env`.

## Storybook

Every product UI page has a Storybook entry under `Pages/*` (public, supporter, project dashboard, admin), plus component stories. Theme toolbar switches Paperlight light/dark via `data-theme`.

```bash
pnpm storybook          # http://localhost:6006
pnpm build-storybook    # packages/ui/storybook-static
```

Coverage includes all route-facing compositions used by `apps/web` (home, explore, project support, dashboards, admin, legal docs, claim/reply, etc.).

## Local infrastructure

`infra/docker/docker-compose.yml` provides:

- **postgres** — primary database (port 5432)
- **rustfs** (optional profile) — S3-compatible storage via MinIO API (ports 9000/9001)
- **tigerbeetle** (optional profile) — placeholder container until TigerBeetle is wired

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
