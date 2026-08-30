# 04 — Payments, authentication and integrations

## 1. Stripe Connect configuration

Use Stripe Accounts v2 for a new platform, subject to live-account support at implementation time.

Desired account configuration:

```text
dashboard                    full
defaults.responsibilities.fees_collector   stripe
defaults.responsibilities.losses_collector stripe
configuration.merchant.capabilities.card_payments.requested true
```

This gives the project a full Stripe Dashboard, makes Stripe collect payment fees from the connected account and assigns negative-balance responsibility to Stripe where supported. Stripe handles KYC collection in this configuration.

Use embedded Stripe onboarding inside the oss.tips project dashboard. Store only Stripe account IDs, capability/status snapshots and public business details required by the product.

## 2. Charge type

Use **direct charges** on the connected project account.

Consequences:

- The charge and subscription customer live on the connected account.
- The project is displayed as merchant/statement descriptor where supported.
- Stripe fees and disputes debit the connected project account.
- oss.tips collects an application fee.
- Objects are scoped by `Stripe-Account`; every database binding must include the connected account ID.

Never create a platform charge followed by a payout for normal support.

## 3. Checkout UI

- Stripe Checkout embedded page inside an oss.tips checkout shell.
- Hosted Checkout fallback.
- Dynamic payment methods enabled; do not hardcode a broad static list.
- Register `oss.tips` payment-method domains for direct charges through the API where required.
- Checkout displays project, cadence, project amount, optional oss.tips tip, entitlement duration and merchant information.
- The project’s custom domain never hosts the payment frame; it redirects to `oss.tips`.

## 4. Payment methods

Request/display methods dynamically according to connected-account country, capability, currency, amount and Checkout mode.

Initial desired families when eligible:

- Cards.
- Apple Pay / Google Pay / Link.
- UK Pay by Bank and relevant European bank methods.
- SEPA Direct Debit and other delayed methods for subscriptions where supported.
- Local wallet/payment methods supported for direct charges.
- Stripe stablecoin payment method when capability is active.

Do not promise every Stripe method. Some methods have limited direct-charge or subscription support and connected accounts with full dashboards may have to enable them themselves.

## 5. Localised currency

- Project chooses one default integration/settlement currency.
- Enable Stripe Adaptive Pricing/localised presentment where Connect supports it.
- Supporter can choose the project currency instead of converted price.
- Stripe’s localised price includes a customer-paid conversion margin; disclose that the final exchange rate is supplied by Stripe.
- Original presentment, settlement and application-fee currencies are stored.
- No oss.tips FX wallet or custom rate engine.

For membership tiers, Stripe-localised pricing is preferred. If a method/currency cannot recur, Checkout falls back to compatible options rather than failing after selection.

## 6. One-off payment creation

Server input:

```json
{
  "project": "rust",
  "tierId": "optional",
  "projectAmountMinor": 1000,
  "projectCurrency": "gbp",
  "platformTipMinor": 100,
  "publicOptions": {
    "showName": true,
    "showAmount": false,
    "showMessage": true
  }
}
```

Server validates project state, connected account, limits, tier and currency; computes immutable fee allocation; creates a connected-account Checkout Session with application fee and metadata IDs; then stores a short-lived checkout intent.

Never accept application-fee amount from the client.

## 7. Subscription creation and fees

Create products/prices on each connected account because direct-charge subscriptions live there. Maintain a Stripe binding per tier/cadence/currency/version; never mutate an existing price used by supporters.

The exact fee for each subscription invoice is set as `application_fee_amount` during `invoice.created` before finalisation:

```text
application_fee_amount = round(project_membership_amount × project_fee_rate)
                       + supporter_platform_tip
```

This is preferred over one `application_fee_percent` because supporter tips and rounded project fees need an exact minor-unit amount. The invoice-level value overrides any subscription percentage.

The `invoice.created` handler must be fast and idempotent; Stripe can delay automatic finalisation when it does not receive a successful response. The webhook ingestion endpoint still only stores events; a high-priority finance worker handles the invoice update immediately and explicitly finalises when appropriate.

## 8. Stripe webhook set

At minimum subscribe to connected-account events for:

```text
account.updated
account.application.deauthorized
checkout.session.completed
payment_intent.processing
payment_intent.succeeded
payment_intent.payment_failed
charge.refunded
charge.dispute.created
charge.dispute.updated
charge.dispute.closed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.created
invoice.finalized
invoice.paid
invoice.payment_failed
invoice.payment_action_required
payout.failed
```

Event type lists are versioned in code. Retrieve authoritative objects when a thin event or ordering gap requires it.

## 9. Refunds

- Project owner/finance role may issue full or partial refunds from oss.tips.
- The refund is created in the connected-account context.
- Refund application fee proportionally, including supporter tip.
- Require a reason and recent authentication.
- Reflect pending/succeeded/failed provider refund state; never mark complete before Stripe.
- Platform admins can issue exceptional refunds for fraud, duplicate payment, legal obligation or serious policy violation.

No supporter invoice generator is built. Stripe receipts and any project-issued invoice remain authoritative.

## 10. Stablecoin payments

Design in v1, capability-gated:

- Stripe stablecoin payment method.
- Checkout, Connect and Billing support are used where eligible.
- Customer wallet is redirected through Stripe’s crypto flow.
- Settlement reaches Stripe balance in local fiat currency.
- Refund returns stablecoin to the original wallet.
- No chargeback dispute flow for this method.

Current limitation: Stripe’s public eligibility list includes the US and private preview in specified EU/other countries, but not UK businesses. Therefore:

- Implement capability detection (`crypto_payments == active`).
- Hide all crypto copy and controls when unavailable.
- Do not market “crypto at launch” until a live UK platform test succeeds.
- Describe it as wallet/accountless support, not “truly anonymous”; public blockchains and Stripe compliance checks do not provide true anonymity.

If Stripe later enables UK accounts, crypto can switch on without a second ledger or provider integration.

## 11. Better Auth configuration

Plugins/features:

- SvelteKit cookie integration.
- Email OTP.
- Passkeys.
- Organisation/team management.
- Generic OAuth.
- Social OAuth for GitHub, Google, Discord and GitLab.
- API key/bearer support only for the public project API where appropriate; do not replace browser sessions with JWTs.

Passwords remain disabled.

### Email OTP policy

- Six digits.
- Five-minute validity.
- Store only a secure hash, attempt counter and expiry.
- Only the newest active sign-in OTP is usable per email/purpose.
- Per-IP and per-email send/verify limits.
- Uniform responses to prevent account enumeration.
- Invalidate after success or too many attempts.
- High-priority Resend queue.
- Authentication mail uses an isolated PostgreSQL `otp` queue and a dedicated
  worker; general workers never claim it.

### Passkeys

- Optional enrolment after sign-in.
- Multiple passkeys per account with names and last-used time.
- Relying party is `oss.tips`; custom domains never perform auth.
- Sensitive actions request recent auth and encourage a passkey but do not require one.

### Sessions

- Secure, HttpOnly, SameSite=Lax cookies.
- Short idle timeout for admin/finance contexts; normal supporter sessions longer.
- Session list and remote revoke.
- Rotate on privilege change and account linking.
- OAuth account linking requires an existing authenticated session or verified email match according to a strict policy; never merge solely on an unverified provider email.

## 12. OAuth providers

Built-in production providers:

- GitHub.
- GitLab.com.
- Codeberg.
- Google.
- Discord.

Self-hosted Gitea/Forgejo:

- Repository URL is accepted without OAuth.
- A forge administrator may register an oss.tips OAuth application and submit issuer/base URL, client ID and secret.
- Configuration is admin-reviewed and stored encrypted.
- Validate issuer/authorisation/token/userinfo URLs against SSRF rules; no arbitrary user-provided OAuth endpoint is contacted during login.
- Repository ownership can always be proven by file or website/DNS challenge instead.

## 13. Project teams

Use Better Auth organisations only as an authentication/team primitive. oss.tips domain permissions remain in its own capability tables so financial/editorial rules are explicit and auditable.

Invite flow:

- Owner/admin enters email.
- Recipient signs in through any supported method with that verified email.
- Invite has expiry, role and project scope.
- Finance/owner changes create security notifications.

## 14. Discord

OAuth is used to link a supporter identity; bot installation is a distinct guild admin flow.

Security:

- Store bot token in secret manager/env only.
- Encrypt refresh/access tokens at rest when retained.
- Request minimum scopes.
- Enable only Discord `GUILD_MEMBERS` privileged intent (the bot also requests `GUILDS`) so member join/update events can trigger role reconciliation.
- Verify guild admin capability before mapping roles.
- Never let a project choose a role at or above the bot’s role.
- Queue role changes and make them idempotent by `(guild,user,role,desired_state,entitlement_version)`.

## 15. Resend email templates

Required templates:

- Email OTP.
- New sign-in/security event.
- Project team invitation.
- Project approved/rejected/action required.
- Support receipt confirmation link for guest.
- Membership started/renewed/cancelled/payment failed/grace ending.
- Project thank-you/reply notification.
- Refund/dispute notice.
- Stripe account restriction.
- Domain verification/certificate failure.
- API key/webhook/security changes.

All financial emails name the recipient project and distinguish the project amount from oss.tips fees/tips.

## 16. Cloudflare custom domains

Only available while `project_feature_mode = contributes_5_percent`.

Lifecycle:

```text
requested -> awaiting_dns -> validating -> active
          -> failed
active -> grace_disabled -> removed
```

- Use Cloudflare for SaaS custom hostname API.
- Support CNAME subdomains in beta; apex support only where Cloudflare configuration supports it cleanly.
- Require host ownership and prevent reserved/internal/oss.tips domains.
- Custom domain maps to exactly one project.
- Set canonical URL to the custom domain only after active if project selects it; default `oss.tips/<slug>` remains a redirect/fallback.
- Leaving 5% mode starts a visible 30-day grace period, after which custom-domain routing is removed.

## 17. Project webhooks

See `05-API-AND-WEBHOOKS.md`. Webhooks are an integration surface, not a way to bypass entitlement/payment rules. No project-supplied callback executes synchronously in a Stripe webhook transaction.
