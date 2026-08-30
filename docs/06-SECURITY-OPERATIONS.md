# 06 — Security, operations and launch governance

## 1. Security posture

oss.tips handles financial metadata, private content, account recovery and connected third-party identities. Treat it as a payment platform even though card/wallet credentials never reach oss.tips.

Core controls:

- Minimise stored personal/payment data.
- Strong separation between project, supporter and platform scopes.
- Durable, idempotent processing for every financial transition.
- No user input reaches Stripe amounts, TigerBeetle IDs, SQL, object paths, OAuth endpoints or webhook destinations without validation.
- Privileged actions require recent authentication, reason and audit event.
- Safe degradation: uncertain payment state never becomes an entitlement.

## 2. Primary threats and mitigations

| Threat                     | Controls                                                                                       |
| -------------------------- | ---------------------------------------------------------------------------------------------- |
| Account takeover           | OTP limits, optional passkeys, OAuth security, session rotation/revocation, security notices   |
| Project ownership theft    | repository/site proof, manual recovery, cooling-off on ownership change, immutable audit       |
| Payout theft               | oss.tips never stores/edits bank details; changes occur in Stripe                              |
| Webhook forgery/replay     | raw-body signature verification, timestamp checks, unique event IDs                            |
| Double payment/entitlement | Stripe idempotency keys, unique intents/events, deterministic ledger transfers                 |
| SSRF                       | allowlisted OAuth config; webhook/domain URL/IP validation and revalidation                    |
| Stored XSS                 | Markdown AST sanitisation, no arbitrary HTML/iframe, CSP, safe embed providers                 |
| Malicious uploads          | quarantine, MIME sniff, ClamAV scan, decode/re-encode, sanitise SVG, reject executables, quota |
| Cross-project data leak    | mandatory project scope in repositories, policy tests and database constraints                 |
| Admin misuse               | least privilege, no silent impersonation, audit trail, reason, future dual control             |
| Supply-chain compromise    | lockfile, provenance/SBOM, dependency review, minimal container, secret scanning               |
| Telemetry leak             | on-host OTel redaction, no bodies/tokens/email/payment identity exported                       |
| Abuse/spam                 | Cloudflare limits, OTP throttles, message bounds, report/block, review queue                   |

## 3. Web security baseline

- TLS only, HSTS after custom-domain flow is proven.
- Secure/HttpOnly/SameSite cookies.
- CSRF tokens/origin validation on mutations.
- Strict CSP using nonces/hashes; no `unsafe-inline` scripts.
- `frame-ancestors 'none'` except Stripe’s own embedded requirements are handled in the application page, not by allowing oss.tips framing.
- `X-Content-Type-Options: nosniff`, strict referrer policy and permissions policy.
- Escape all project content by default.
- Signed, short-lived private asset URLs.
- Constant-time token/hash comparisons.
- Request body and multipart limits at Cloudflare, reverse proxy and application.
- JSON mutation bodies are capped at 256 KiB in-app; uploads and webhooks keep route-specific caps.

## 4. Secrets and encryption

- Production secrets live in Coolify secret variables, not repository or database.
- Separate secrets for Better Auth, Stripe webhook endpoints, Resend, OAuth, Discord, Cloudflare, asset signing, API-key hashing and telemetry hashing.
- Encrypt stored OAuth refresh tokens, webhook secrets and provider credentials with an application envelope key.
- Rotation procedures and dual-key read period.
- Never log secrets or full provider payloads.
- Off-host backup encryption key stored separately from the server and backup objects.

## 5. Authorisation

Use one central policy API:

```ts
can(actor, capability, resource): Decision
```

Every server load/action/API route calls it. UI hiding is not authorisation.

Financial/refund actions additionally require:

- finance capability.
- recent authentication.
- project matches payment.
- amount within refundable balance.
- reason.
- idempotency key.

Admin “view as” receives a synthetic read-only policy context; it never creates a real project session or bypasses audit.

## 6. Audit log

Append-only event fields:

```text
id, occurred_at, actor_type/id, session_id, action,
resource_type/id, project_id, reason, ip_hash,
before_hash, after_hash, correlation_id, metadata_redacted
```

Audit events include team/ownership, project status, fee mode, custom domain, Stripe link state, refunds, API keys, webhook secrets, Discord mappings, admin cases and account recovery.

No update/delete API. Corrections are new audit events.

## 7. Upload security

- Presigned URL restricted to exact key, size and content type hint.
- Completion endpoint verifies actual object size/hash.
- Quarantine bucket cannot be served publicly.
- Decode raster images with memory/pixel limits; reject decompression bombs.
- Strip EXIF/GPS.
- Sanitize SVG with an allowlist or rasterise.
- Scan PDF/plain-text attachments with the configured ClamAV daemon before promotion; reject executables, scripts, HTML, package formats and password-protected archives in beta. A missing or unreachable scanner fails closed.
- User-facing filename is metadata, not storage path or response header without escaping.

## 8. Privacy and data residency

Adopt the agreed practical statement:

> Primary application database data, RustFS objects and backups remain in the UK/EU. Payment, authentication, email and observability processors handle only data necessary to provide their services under their contractual transfer safeguards. Telemetry is redacted before export.

Resend’s region controls delivery location, not storage of account metadata. OAuth and Stripe necessarily process data outside the app’s own EU infrastructure in some cases.

Privacy defaults:

- Project does not receive supporter email by default.
- Newsletter/marketing consent is separate from payment.
- Public supporter identity/amount/message are separate opt-ins.
- No ad-tech or fingerprinting.
- Data export and deletion workflows.
- Records of processing, retention schedule and processor register.
- DPIA for payments, project discovery, public supporter wall and observability before full launch.

## 9. Legal/operational launch work

The direct-charge model materially reduces custody risk, but a UK payment-services solicitor should review the final flow. The FCA requires businesses to assess whether their activity is a regulated payment service; do not rely on the commercial-agent exclusion without advice.

Required policies/pages:

- Platform terms.
- Project/connected-account terms.
- Supporter terms.
- Privacy notice.
- Cookie notice/preferences.
- Acceptable-use and prohibited-project policy.
- Refund/dispute policy.
- Copyright/impersonation complaint process.
- Account recovery/ownership transfer policy.
- Security and vulnerability disclosure policy.
- Transparency/fee page.

Tax/reporting:

- oss.tips is VAT registered and invoices its application fees to projects where required.
- Projects remain responsible for treatment of support/membership benefits.
- Obtain advice on digital services and whether gated rewards make oss.tips a deemed supplier in any scenario.
- Determine whether UK digital-platform reporting rules apply; if so, collect/verify seller information and report on schedule even though Stripe also performs KYC.

## 10. Backup and recovery

### PlanetScale

- Provider PITR/backups enabled and retention reviewed.
- Weekly logical encrypted export to a separate EU destination for provider independence.
- Schema/migrations and restore scripts tested.

### RustFS

- Daily encrypted incremental replication/off-host backup to a separate EU system.
- Weekly inventory/hash verification.
- Object versioning where tested and reliable; do not rely on unsupported S3 behaviour.

### TigerBeetle

- Local data file on dedicated storage.
- Periodic filesystem-level copy only according to TigerBeetle-supported recovery procedure; do not treat a live arbitrary copy as sufficient.
- Canonical replayable posting-intent journal in PlanetScale.
- Monthly fresh-cluster replay drill during beta, then quarterly.

### Targets

- PostgreSQL RPO: five minutes or provider PITR capability, whichever is better.
- RustFS RPO: 24 hours initially; reduce for private content if needed.
- Full-host RTO: four hours target.
- No contractual beta SLA; internal 99.9% SLO.

## 11. Single-host reality

The requested 99.9999999% would permit only milliseconds of downtime and cannot be achieved on one Coolify server. Avoid misleading public claims.

Mitigations without buying a new application server:

- PlanetScale HA for database.
- Cloudflare cache/stale public pages.
- Two local web processes.
- Durable remote database queue.
- Off-host backups.
- Automatic container restart and host monitoring.
- Static status page hosted independently, ideally Cloudflare Pages.

Actual host failure still removes dynamic service until recovery.

## 12. Incident runbooks

Required before live money:

1. Stripe webhook backlog/signature failure.
2. Incorrect application fee.
3. Duplicate or missing ledger posting.
4. TigerBeetle unavailable/corrupt data file.
5. PlanetScale failover/outage.
6. Connected account compromise or restriction.
7. Refund/chargeback surge.
8. OAuth/OTP account takeover.
9. Leaked API/webhook/Discord token.
10. Malicious private attachment/public XSS report.
11. RustFS data loss/quota exhaustion.
12. Custom-domain takeover/certificate failure.
13. Personal-data breach and ICO notification assessment.

Each runbook states trigger, immediate containment, evidence to preserve, user communication, recovery and postmortem owner.

## 13. Monitoring and alerts

Page/urgent alerts:

- Payment event older than five minutes unprocessed.
- Ledger posting failure or reconciliation mismatch.
- Stripe account capability/payout failure affecting active project.
- Database error rate, pool exhaustion or p95 spike.
- TigerBeetle unavailable/disk/memory alert.
- RustFS unavailable/quota near full.
- OTP/Resend failure spike.
- Discord role queue age over ten minutes.
- Custom-domain certificate failure.
- Elevated 5xx or auth failures.

Ticket/non-urgent:

- Project review queue age.
- Webhook endpoint disabled.
- Soft bounce trend.
- Near storage/project quota.
- Translation missing keys.

As sole operator, alerts must be sparse and actionable. Alert on user impact or violated invariants, not every transient retry.

## 14. Testing strategy

### Unit/property

- Fee allocation and rounding across currencies.
- Membership state machine.
- Entitlement evaluation.
- Permission policy.
- TigerBeetle posting balance invariants.
- Webhook signature and SSRF validation.

### Integration

- Stripe sandbox/test clocks and Connect accounts.
- Out-of-order/duplicate events.
- Delayed payment methods.
- Refund/dispute/failed renewal.
- TigerBeetle restart/replay.
- PlanetScale/PgBouncer reconnect behaviour.
- RustFS presigned upload and private download.
- Discord mock/guild integration.
- Resend webhook handling.
- Cloudflare custom hostname lifecycle.

### End-to-end

- Guest one-off.
- Account recurring monthly/annual.
- Tier upgrade/downgrade/cancel/grace.
- Private post and attachment.
- Public wall opt-in and removal.
- Project thank-you to guest and signed-in supporter.
- Project refund and admin exceptional refund.
- Custom-domain public page to oss.tips checkout.
- Keyboard/screen reader/reduced motion.

The local demo journey suite in `e2e/journeys.spec.ts` covers checkout-intent
requests for one-off/monthly/annual support, explicit supporter-wall choices,
next-renewal cancellation, grace/refund display records, gated public-post
denial, signed-in reply success/failure, immutable admin refund history, and a
custom-host checkout redirect. Stripe, storage, and database calls are mocked
or kept in their honest unavailable state.

Current demo exclusions:

- Stripe-confirmed payment and entitlement issuance; demo checkout stops at
  `processing` because no webhook/database state exists.
- Private attachment entitlement/download; no demo attachment or storage
  fixture is exposed, so the route is asserted as database-unavailable.
- Guest claim/reply send states; guest links remain unavailable without the
  database, while signed-in supporter/project reply controls are exercised.
- Admin refund submission; admin cases has no refund control, so the suite
  checks the existing immutable refund audit row instead.
- Real custom-domain DNS/hostname resolution; local `grove.localhost` host
  exercises the public-page-to-Stripe boundary, while resolver lifecycle
  coverage remains integration scope.

### Financial golden tests

Store provider event fixtures and expected PostgreSQL/TigerBeetle postings. Replay the complete corpus after every payment-domain change.

## 15. Public beta launch gates

Do not take live money until all are true:

- Stripe platform and Connect live mode approved.
- Live direct-charge payment and application fee tested with a real low-value payment/refund.
- Terms/privacy/AUP/refund documents published.
- Webhook duplicate/out-of-order tests pass.
- Ledger replay and reconciliation pass.
- Off-host backup and restore tested.
- Admin can suspend project/payments and refund.
- Email OTP and security notices deliver reliably.
- Abuse/security contacts published.
- No high/critical findings in dependency, secret and application scans.
- Status page and incident communication path live.

Crypto is not a launch gate because current UK Stripe eligibility may prevent it.
