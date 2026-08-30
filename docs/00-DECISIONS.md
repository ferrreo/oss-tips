# 00 — Final decision register

**Status:** implementation baseline  
**Operator:** UK limited company  
**Commercial posture:** cost recovery / sustainable public-good business  
**Software licence:** BSD 3-Clause “New” or “Revised” License

## Product boundary

oss.tips is an open-source project support and membership platform. It is **not** a general marketplace.

Included:

- One-off support from guests or signed-in supporters.
- Monthly and annual memberships.
- Tiers, goals, public supporter walls, private/public posts and attachments.
- Discord rewards.
- Project-to-supporter thank-you replies tied to a payment or membership.
- Project and supporter analytics.
- Tax/accounting exports.
- Public API and signed outgoing webhooks.
- Custom project domains for projects that enable the 5% contribution mode.
- Multiple interface languages and Stripe-localised presentment currencies.

Excluded from v1:

- Physical or digital shop/catalogue functionality.
- Cross-project baskets or split recipients.
- Project wallets, stored balances, escrow, manual withdrawals or custody.
- Arbitrary direct messages and public comments.
- Hosted video transcoding.
- PayPal.
- Automatic source-licence policing.

## Funds flow

- A project has one legal payout recipient.
- The project is the merchant/payee and is responsible for its own tax and reward obligations.
- Stripe settles direct charges to the project’s connected account.
- oss.tips receives an application fee in the same transaction.
- Stripe is configured to collect its fees from the connected project and to bear connected-account negative-balance responsibility where Stripe permits this configuration.
- oss.tips never exposes or holds a withdrawable project balance.

## Fee model

Let `P` be the amount designated for the project and `T` the supporter’s optional platform tip.

| Project mode      | One-off | Monthly | Annual | Storage | Custom domain |
| ----------------- | ------: | ------: | -----: | ------: | ------------: |
| Standard          |      0% |      2% |     2% |    1 GB |            No |
| Supports oss.tips |      5% |      5% |     5% |    5 GB |           Yes |

For every successful charge:

```text
customer_charge      = P + T
oss_project_fee      = round(P × fee_rate)
oss_supporter_tip    = T
stripe_application_fee = oss_project_fee + oss_supporter_tip
project_before_stripe = P - oss_project_fee
```

Stripe processing fees are charged to the project on the full customer charge, including `T`. This is disclosed in project settings.

A change between standard and 5% mode affects future charges and subscription renewals from the next billing boundary. It does not re-price the supporter.

## Eligibility and verification

- Individuals must be adults; companies, charities and foundations are accepted where Stripe accepts them.
- Exactly one Stripe-connected legal recipient per project.
- Project must provide a real website, verified contact email, repository link and a declaration that it is open source.
- Supported repositories include GitHub, GitLab, Codeberg, Gitea/Forgejo and generic public repository URLs.
- No automated licence enforcement in beta; oss.tips may manually audit or unlist misleading projects.
- Pages may be published before Stripe onboarding is complete; payments remain disabled until the account is eligible.

## Authentication

- No passwords.
- Email sign-in uses a numeric one-time code, not a magic link.
- Social sign-in: GitHub, GitLab.com, Codeberg, Google and Discord.
- Optional passkeys for all users.
- Self-hosted Gitea/Forgejo can be configured as a generic OAuth provider by the forge operator; repository linking never requires OAuth.
- Guest one-off support is allowed.
- An account is required for recurring support and entitlement management.
- Passkeys are recommended but not mandatory for project or platform roles.

## Infrastructure

- SvelteKit application, workers and Discord bot deployed on one dedicated server through Coolify.
- PlanetScale Postgres PS-5 HA in London for production.
- Local PostgreSQL for development.
- TigerBeetle from day one: Docker/local in development and one local production replica on dedicated storage, treated as rebuildable until a real multi-machine cluster exists.
- RustFS for objects.
- Cloudflare for DNS, CDN, WAF and Cloudflare for SaaS custom hostnames.
- Resend for transactional mail and email OTP.
- Maple.dev via an on-host OpenTelemetry Collector with aggressive redaction.

## Scale and service level

Initial design target:

- 500 projects.
- 10,000 successful transactions per month.
- 10,000–50,000 registered supporters without redesign.
- No contractual beta SLA.
- Internal application SLO: 99.9%.
- Database service has a higher provider SLA, but end-to-end availability is limited by the single application host and local TigerBeetle.

## External launch blockers

These cannot be solved by application code alone:

1. Create and verify the Stripe business account.
2. Create the Stripe Connect platform profile and obtain live-mode access.
3. Confirm the intended Accounts v2/direct-charge configuration with Stripe.
4. Configure the production payment methods and connected-account countries.
5. Create OAuth applications and the Discord bot.
6. Configure Resend domain DNS, DKIM/SPF/DMARC and webhook handling.
7. Publish platform terms, project terms, privacy, acceptable-use, refund/dispute and cookie policies.
8. Obtain UK payments/legal review of the final funds-flow diagram.
9. Determine whether oss.tips is a reporting digital platform operator and implement seller information collection if required.
10. Configure an off-host EU backup destination.

## Current crypto decision

Stripe stablecoin payments are the only crypto rail in v1. The integration is implemented behind capability checks. The feature is not advertised or shown unless both the platform and connected account are eligible. The current public Stripe eligibility list excludes UK businesses, so this is likely code-ready rather than live on beta launch day.
