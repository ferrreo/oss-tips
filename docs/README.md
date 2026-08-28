# oss.tips product, architecture and brand pack

This pack turns the agreed product decisions and the selected **Paperlight** light/dark direction into an implementation-ready specification.

## The direct answer on the database plan

The proposed **PlanetScale Postgres PS-5 high-availability cluster in London** is enough for the public beta target of roughly 500 projects and 10,000 transactions per month. It provides a primary plus two replicas, 10 GB initial storage, the normal production egress allowance, and far more I/O capacity than this workload should require. Start there, connect through the included PgBouncer endpoint, cap application pools tightly, and define upgrade thresholds rather than pre-buying capacity.

The principal availability limitation remains the single Coolify host and the single local TigerBeetle replica—not PlanetScale.

## Important launch caveat

Stripe stablecoin payments are designed into v1 as a capability-gated payment method. Stripe's current public eligibility list does **not** include UK businesses, although Connect and subscriptions are supported in eligible regions. The UI and domain model should ship ready, but crypto must remain hidden until the platform and connected account report an active `crypto_payments` capability.

## Contents

| File | Purpose |
|---|---|
| `00-DECISIONS.md` | Final decision register and unresolved external blockers |
| `01-PRODUCT-SPEC.md` | Full product behaviour and dashboard requirements |
| `02-ARCHITECTURE.md` | Runtime, deployment, PlanetScale, RustFS, caching and observability |
| `03-DATA-AND-LEDGER.md` | PostgreSQL model, TigerBeetle model, idempotency and reconciliation |
| `04-PAYMENTS-AUTH-INTEGRATIONS.md` | Stripe, crypto, Better Auth, Resend, Discord and custom domains |
| `05-API-AND-WEBHOOKS.md` | Public API and outgoing webhook contracts |
| `06-SECURITY-OPERATIONS.md` | Security model, legal launch work, backups and runbooks |
| `07-BRAND-IDENTITY.md` | Final Paperlight identity, logo, palette, type and voice |
| `08-DESIGN-SYSTEM.md` | Components, motion, responsive behaviour and accessibility |
| `09-IMPLEMENTATION-PLAN.md` | Repository layout, workstreams, tests and beta launch gates |
| `assets/` | Selected mockups, SVG/PNG logos, brand board and code-ready tokens |
| `SOURCES.md` | Current primary-source references used by the plan |

## Source mockups

- `assets/paperlight-light-reference.png`
- `assets/paperlight-dark-reference.png`

The mockups are visual direction, not pixel-perfect product screens. The specifications in the design documents take precedence where the generated mockups contain invented labels, impossible density, or inaccessible details.
