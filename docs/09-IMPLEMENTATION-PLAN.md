# 09 — Implementation and beta launch plan

## 1. Build order

The fastest safe route is vertical slices that settle real Stripe test payments through the real ledger, not building every dashboard screen before the financial core.

### Slice A — foundation

- Monorepo, SvelteKit, StyleX/Paperlight tokens, error model and OTel.
- PlanetScale/local Postgres migrations and repository layer.
- Better Auth email OTP/OAuth/passkey.
- Project/team/permission model.
- RustFS upload pipeline.

### Slice B — one-off support

- Stripe Connect Accounts v2 onboarding.
- Project payment readiness.
- One-off Checkout direct charge.
- Durable event inbox.
- TigerBeetle account/posting adapter.
- Payment read model and public success state.
- Guest claim and public-wall settings.

This slice must be fully reconciled/refundable before subscriptions.

### Slice C — memberships

- Tiers/prices by connected account.
- Monthly/annual Checkout/Billing.
- Exact invoice application fee.
- Membership state machine, grace and entitlements.
- Stripe customer portal/session for each project account.

### Slice D — engagement

- Posts/editor/private attachments.
- Supporter feed.
- Payment-bound thank-you threads.
- Discord role mapping/reconciliation.
- Goals.

### Slice E — platform surfaces

- Project dashboards/analytics/exports.
- Admin review, audit, refunds, restrictions and reconciliation.
- Public API/webhooks.
- Custom domains.
- I18n translations.

## 2. Seven-day beta schedule

The schedule assumes unusually high implementation throughput, but external approval is still the critical path.

### Day 0 — immediately

- Open Stripe account and Connect platform application.
- Start legal policy drafting/review.
- Create Resend, OAuth and Discord applications.
- Provision PlanetScale PS-5 London and configure RustFS/backup target.
- Enable Cloudflare for SaaS and add payment details if required.

### Day 1 — platform skeleton

- Repo/runtime/CI.
- Paperlight shell and component primitives.
- Postgres schema, Better Auth OTP/OAuth/passkeys.
- Project/team onboarding and admin review skeleton.
- OTel collector/Maple redaction.

### Day 2 — Stripe and one-off

- Connect embedded onboarding and account status.
- Direct-charge Checkout with dynamic methods and fee modes.
- Webhook inbox/worker.
- TigerBeetle account creation/payment split.
- Refund and reconciliation golden tests.

### Day 3 — memberships

- Tier/pricing model.
- Monthly/annual subscription flows.
- invoice-level application fees.
- State machine, grace, cancellation and supporter billing UI.

### Day 4 — content/community

- Markdown/RTE posts and gated attachments.
- Supporter wall.
- Thank-you threads including guests.
- Discord linking/bot/role reconciliation.
- Goals.

### Day 5 — dashboards/integrations

- Project/admin/supporter dashboards.
- Analytics rollups and tax CSV.
- Public API/OpenAPI and project webhooks.
- Cloudflare custom-domain flow for 5% projects.

### Day 6 — hardening

- Permission/security review.
- Event duplication/order/failure tests.
- Upload/XSS/SSRF tests.
- Backup and TigerBeetle replay drill.
- Accessibility/responsive/dark mode/i18n pass.
- Operational alerts/status page/runbooks.

### Day 7 — controlled public beta

- Real low-value end-to-end payment/refund on several connected accounts/countries.
- Invite a small set of manually approved projects.
- Monitor every payment/reconciliation manually.
- Expand sign-up after 24–48 hours without invariant failures.

If Stripe Connect live approval is not ready, launch project pages and test-mode onboarding but do not describe it as a live-money beta.

## 3. Definition of done by domain

### Payments

- Duplicate/out-of-order event corpus passes.
- Every charge splits to zero transit balance.
- Refund/dispute corrections balance.
- Daily Stripe reconciliation has zero unexplained differences.
- Payment never depends on client redirect.

### Auth/permissions

- No passwords/routes enabled.
- OTP enumeration and rate-limit tests pass.
- Cross-project property tests fail closed.
- Sensitive action/session rotation covered.

### Content

- Markdown round-trip fixture corpus.
- Sanitiser/embed/upload adversarial tests.
- Private attachment cannot be accessed by public URL or stale entitlement.

### Discord

- Desired-state role tests for join/leave/renew/fail/refund.
- Missing permissions visible and retried safely.

### API/webhooks

- OpenAPI validation in CI.
- Signature fixtures in multiple languages.
- SSRF test corpus.
- Replay and endpoint-disable flows.

### Design

- Light/dark parity.
- Keyboard and screen-reader primary flows.
- No unresolved critical/serious axe failures.
- Performance budgets measured on production build.

## 4. CI/CD

Pipeline:

1. Format/lint/typecheck.
2. Unit/property tests.
3. Migration validation on temporary Postgres.
4. Stripe/TigerBeetle/RustFS integration tests.
5. Playwright E2E and accessibility.
6. Build containers and SBOM.
7. Dependency/secret/container scan.
8. Deploy staging.
9. Smoke test and manual production promotion.

Database migrations are expand/contract and backward-compatible with the prior application image. Financial posting changes carry a posting version and golden replay fixtures.

## 5. Environment separation

```text
local       local Postgres + RustFS + one TigerBeetle development replica + Stripe sandbox
staging     separate PlanetScale branch/database, Stripe sandbox, separate buckets/bot/server
production  PlanetScale production branch, live Stripe, production domains/secrets
```

Never mix live Stripe webhooks or object buckets with staging.

## 6. Initial project rollout

- Start with 5–10 known OSS projects.
- Manual review and direct operator contact.
- Cap first-week payment value if Stripe/risk requires.
- Review every refund/dispute and reconciliation difference.
- Publish transparent beta limitations.
- Add projects in batches until 50, then open sign-up if support burden is acceptable.

## 7. Post-beta roadmap

Only after v1 is stable:

1. PayPal partner integration behind the same provider abstraction.
2. Real six-replica TigerBeetle deployment across machines/sites.
3. More Discord guilds, Matrix/Forge integrations.
4. Corporate sponsorship/Purchase Order workflows.
5. Additional translations.
6. Enhanced project discovery/dependency funding metadata.
7. Optional email updates/newsletters with explicit consent.
8. More Stripe payment methods/countries as capabilities become available.

A shop remains out of scope unless the legal/tax/operational product is deliberately reopened.

## 8. First operational purchases

The selected PlanetScale PS-5 HA is the only clearly justified immediate paid infrastructure addition. Cloudflare for SaaS may require a payment method but includes the first custom-hostname allowance. Do not buy a larger database, Redis, Kafka or Kubernetes capacity before metrics justify it.

The first reliability spend after launch should be a second application/backup host or properly replicated TigerBeetle capacity—not a larger primary database.
