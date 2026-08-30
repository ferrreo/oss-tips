# 01 — Product specification

## 1. Product promise

**Open source thrives with you.**

oss.tips gives open-source projects a calm, transparent place to receive one-off support and recurring memberships without turning maintainers into shopkeepers or forcing supporters into a social network.

The service must feel:

- Trustworthy enough for money.
- Human enough for communities.
- Technical enough for maintainers.
- Transparent about every fee and entitlement.
- Fast even on modest hardware and poor connections.

## 2. Product principles

1. **Projects own the relationship.** The project is the payee and merchant; oss.tips supplies infrastructure and integrations.
2. **No custody.** The platform does not hold funds or invent an internal wallet.
3. **No fee surprises.** Show the project amount, oss.tips project fee, optional supporter tip, payment method and renewal cadence before confirmation.
4. **Guest-friendly.** A person can make a one-off payment without creating an oss.tips account.
5. **Accounts earn their complexity.** Sign-in is required only for subscriptions, entitlements, replies and account history.
6. **Rewards are memberships, not a hidden shop.** No per-post prices, catalogue, inventory, licence keys or “buy now” language.
7. **Privacy by default.** Public recognition and amount disclosure are separate opt-ins.
8. **Useful dashboards, not vanity charts.** Every metric must lead to a decision or action.
9. **Accessible and quick.** WCAG 2.2 AA, keyboard-complete and reduced-motion aware.
10. **Manual review beats fake certainty.** Projects self-declare as open source; oss.tips can audit rather than pretending licence detection is infallible.

## 3. Personas

### Supporter

Wants to fund a project quickly, understand the fee, receive optional rewards and retain control over public visibility.

### Project owner

Controls legal ownership, Stripe connection, fee mode, team, domains, destructive actions and project closure.

### Project finance member

Views payments, refunds, disputes, exports and reconciliation information. Cannot change payout details through oss.tips.

### Project editor/community member

Publishes posts, manages tier-visible content, handles supporter replies and configures Discord role mappings according to granted permission.

### Platform administrator

Reviews projects, handles abuse/recovery, monitors payment restrictions, sends exceptional refunds and maintains the service. All privileged actions are visible in an immutable audit trail.

## 4. Public information architecture

```text
/
/explore
/about
/pricing
/docs
/security
/transparency
/terms/*
/<project>
/<project>/posts/<slug>
/<project>/goals/<slug>
/<project>/support
```

No canonical `<project>.oss.tips` hostnames are created. The canonical default project URL is `https://oss.tips/<project>`.

A paid-support project may attach one custom domain. The custom domain serves public pages and posts only; sign-in, checkout and dashboards stay on `oss.tips`.

## 5. Landing and discovery

### Home

- Clear mission and primary actions: “Support a project” and “Explore projects”.
- Featured projects are manually curated rather than algorithmically “trending”.
- Explain one-off, monthly and annual support in plain language.
- Disclose fee modes without making the page a pricing spreadsheet.
- Show platform transparency counters only when derived from settled data.

### Explore

- Search by project name, repository, ecosystem and tag.
- Filters: active goals, accepts recurring support, recently updated, language/ecosystem.
- Staff collections and “projects you may know” may be added later.
- No popularity score that rewards payment volume alone.
- Search ranking combines exact name/repository match, text relevance, recent project activity and completeness; payment volume is not a primary ranking signal.

## 6. Project onboarding

### Step 1 — identity

- Create/sign into an account using email OTP or OAuth.
- Create a project or organisation.
- Required: name, slug, public website, verified contact email, repository URL, concise description and open-source declaration.

### Step 2 — project ownership

Beta uses a risk-based approach:

- Repository OAuth ownership where supported.
- Repository file challenge.
- Website/DNS challenge.
- Manual email review.

A project can draft and preview immediately. Duplicate repository claims are blocked and sent to admin review.

### Step 3 — Stripe

- Start embedded Stripe onboarding.
- Page can publish before completion.
- Payment actions remain disabled while `charges_enabled`, `payouts_enabled` or required capabilities are not active.
- Surface Stripe requirements and a direct “Continue verification” action in the project dashboard.

### Step 4 — page and tiers

- Upload logo and banner.
- Set default currency.
- Create one-off presets and up to eight membership tiers.
- Configure supporter wall, goal, posts and Discord.
- Select standard or 5% project mode.

### Step 5 — review and publish

- Automated safety checks for URL validity, duplicate claims, prohibited upload types and obvious impersonation indicators.
- Manual review queue for first payment activation or risk flags.
- Publish status is independent from payment readiness.

## 7. Project public page

Required modules:

1. Project identity: logo, name, verified status, description, repository/site/community links.
2. Support composer: one-off/monthly/annual tabs, presets, custom amount, selected tier and currency.
3. Fee disclosure: visible before opening Stripe Checkout.
4. Goal card: amount/count/MRR target, progress and deadline where applicable.
5. Tiers: cumulative rewards, cadence, member limit and minimum price.
6. Recent public updates.
7. Public supporter wall.
8. Project stats selected by the project; never show private revenue by default.
9. Trust footer: secure payments, project is recipient, fee explanation and report-project action.

### Support composer behaviour

- One-off minimum equivalent of £2; configurable upward per project.
- Ordinary maximum equivalent of £5,000.
- Project chooses a default currency.
- Stripe Adaptive Pricing/localised presentment is used where eligible.
- Presets are expressed in the project’s default currency and localised by Stripe at checkout.
- Custom amount validates server-side in minor units.
- The optional oss.tips tip is separate, editable to zero and clearly labelled.
- Client redirect never grants an entitlement; only verified Stripe events do.

## 8. One-off support

Guest flow:

1. Select amount/tier and public visibility.
2. Optionally enter a display name, message and receipt email.
3. Select an oss.tips tip.
4. Complete Stripe Checkout.
5. On verified success, show receipt state and entitlement expiry.
6. Offer account creation/claim using the same verified email without forcing it.

Signed-in flow additionally records the support in history and makes private content/replies available immediately after the event is processed.

### One-off entitlements

A project may configure a tier’s one-off duration as:

- No entitlement.
- 30 days (default).
- 90 days.
- One year.
- Permanent, with a warning to the project.

Entitlement duration and expiry date are shown before payment. Repeated lower-tier payments do not automatically aggregate into a higher tier.

## 9. Memberships

- Monthly and annual cadences.
- Higher tiers inherit lower-tier rewards by default, with per-reward override.
- Pay-above-minimum supported.
- Annual discount supported through explicit annual prices.
- No free trials in beta.
- Existing supporters cannot have their price silently increased.
- Upgrade: immediate with Stripe proration.
- Downgrade: next renewal.
- Cancellation: access continues to paid-period end.
- Failed payment: seven-day grace period; access and Discord role remain during grace.
- After grace: revoke entitlement and mapped roles.
- Refund/chargeback: recalculate entitlement; full reversal normally revokes immediately.
- Paused/deleted tiers remain valid for existing supporters until explicit migration.

### Supporter platform tip on memberships

The supporter tip recurs with the membership and is presented as recurring. The supporter can remove or alter it from membership settings without changing the project tier. The project cannot set or modify a supporter’s tip.

## 10. Tiers and rewards

A project can create one to eight public tiers with:

- Name, short description, icon and ordered reward list.
- Monthly price, annual price or both.
- Optional member cap.
- One-off access duration.
- Discord roles.
- Minimum post visibility.
- Supporter-wall badge.

Allowed first-party rewards:

- Public badge/recognition.
- Supporter-only posts.
- Private attachments to posts.
- Early releases or builds as attachments.
- Discord roles/channels managed by the project.
- Non-binding polls or roadmap acknowledgements later.

The UI must not describe any attachment as a standalone product. There is no item-level payment or purchase library.

## 11. Posts and gated content

### Authoring

- Markdown is canonical storage.
- Markdown editor round-trips through the domain AST without silently losing supported constructs.
- Headings, emphasis, links, lists, task lists, tables, quotes, footnotes, fenced code, images and attachments.
- Code blocks use a small, deterministic syntax highlighter bundle; language grammars load on demand.
- Embeds: YouTube, Vimeo and PeerTube through allowlisted providers.
- No arbitrary HTML, script or free-form iframe.
- Scheduled publish and draft preview as public/all supporters/minimum tier/selected tiers.
- Public posts expose RSS/Atom.
- Email notification is explicit per post.

### Content visibility

```text
public
signed_in_supporter
minimum_tier_rank
selected_tier_ids[]
```

Visibility is evaluated server-side. Private attachments use short-lived signed URLs after entitlement checks.

## 12. Supporter wall and payment messages

Public wall opt-ins are independent:

- Display name/avatar.
- Supporter message.
- Tier.
- Support duration.
- Amount.

Amount is hidden unless explicitly enabled. A supporter can remove themselves later. Projects can hide abusive messages but cannot edit them.

### Thank-you/reply channel

Every settled one-off support or membership relationship has a bounded private thread:

- Project can send a thank-you or reply to the supporter’s payment message.
- Supporter can reply; project can continue the thread.
- No unsolicited project-to-user thread without a payment relationship.
- No attachments or arbitrary links in beta.
- Rate limits, block/report controls and audit history.
- Guest supporters receive the reply through Resend and can open a short-lived signed reply page or claim an account.
- Project members never receive the supporter’s email address solely to send a reply.

This satisfies the “thank any donation” requirement without creating a general DM system.

## 13. Goals

Types:

- One-time money goal with optional deadline.
- Calendar-month money goal.
- Active supporter-count goal.
- MRR goal.

Rules:

- Uses settled project support before Stripe and oss.tips fees.
- Excludes the supporter tip to oss.tips.
- Subtracts refunds and chargebacks.
- Preserves original currencies and records the conversion snapshot used only for display.
- A project may have several drafts but only a small number of public active goals.

## 14. Discord rewards

- One Discord guild per project at launch.
- Project administrator installs the oss.tips bot.
- Supporter explicitly links one Discord account.
- One or more roles may map to each tier.
- Bot verifies hierarchy and permission before activation.
- Grant on verified entitlement.
- Keep through grace; remove after expiry, refund or chargeback.
- Restore if an entitled user rejoins.
- Nightly reconciliation compares desired and actual role membership.
- Project settings show last sync, failures and missing permissions.

## 15. Supporter account

- Active memberships and renewal dates.
- One-off support and entitlement expiry.
- Private post feed.
- Project replies/inbox.
- Public-wall settings per payment/project.
- Linked Discord and OAuth accounts.
- Passkeys and sessions.
- Data export/delete request.
- Stripe customer-portal links scoped to the relevant connected project account.

Because direct charges create customers on connected accounts, billing management is opened in the correct connected-account context rather than one global Stripe customer portal.

## 16. Project dashboard

Primary sections:

- Overview.
- Inbox and thank-you replies.
- Payments/supporters.
- Memberships and tiers.
- Posts and attachments.
- Goals.
- Discord rewards.
- Analytics.
- Exports.
- API keys and webhooks.
- Custom domain.
- Team and permissions.
- Stripe status.
- Project settings.

Overview must prioritise actionable state:

- Gross settled support, recurring revenue, active supporters and conversion.
- Account restrictions or verification requirements.
- Failed renewals/grace-period count.
- Unanswered supporter messages.
- Discord sync failures.
- Goal progress.
- Recent financial and content events.

## 17. Platform administration

Admin dashboard:

- Project review queue.
- Searchable project/user/supporter directory.
- Stripe restriction and capability queue.
- Refund/dispute workflows.
- Abuse, copyright and impersonation cases.
- Account-recovery/ownership-transfer cases.
- Financial reconciliation status.
- Webhook/queue/Discord/domain failures.
- Infrastructure and storage usage.
- Platform revenue, application fees and optional tips.
- Audit-event explorer.

Privileged actions require a reason and are immutable. No silent impersonation; “view as” is a read-only simulated permission mode with a permanent audit event.

## 18. Roles and permissions

### Project roles

| Capability                | Owner |    Admin | Finance |   Editor | Community |   Analyst |
| ------------------------- | ----: | -------: | ------: | -------: | --------: | --------: |
| Transfer ownership/delete |   Yes |       No |      No |       No |        No |        No |
| Connect/disconnect Stripe |   Yes |       No |      No |       No |        No |        No |
| Change fee mode/domain    |   Yes |      Yes |      No |       No |        No |        No |
| Manage team               |   Yes |      Yes |      No |       No |        No |        No |
| Refund/export finance     |   Yes | Optional |     Yes |       No |        No | Read only |
| Manage tiers/goals        |   Yes |      Yes |      No | Optional |        No | Read only |
| Publish posts             |   Yes |      Yes |      No |      Yes |        No | Read only |
| Reply to supporters       |   Yes |      Yes |      No | Optional |       Yes |        No |
| Discord mappings          |   Yes |      Yes |      No |       No |       Yes | Read only |
| Analytics                 |   Yes |      Yes |     Yes |      Yes |       Yes |       Yes |

Permissions are stored as capabilities so custom roles can be introduced later without schema replacement.

### Platform roles

Owner, operations, finance, moderation, support and read-only auditor. The initial single operator receives owner, but code must not hard-code a one-person platform.

## 19. Analytics

### Project

- Gross settled support.
- Refunds/disputes.
- oss.tips project fees and supporter tips shown separately.
- Stripe processing fee where available.
- Estimated project net.
- One-off versus recurring.
- MRR/ARR.
- New, active, grace, cancelled and expired memberships.
- Retention/churn and tier mix.
- Currency and country-level distribution.
- Public page views, support-composer opens and completed conversion.
- Referrer category without fingerprinting.
- Goal progress.

### Supporter

- Lifetime support by project and currency.
- Active/expired entitlements.
- Renewal calendar.
- Public recognition settings.

### Privacy

No third-party behavioural advertising, cross-site tracking or fingerprinting. Store coarse aggregate events. IP addresses are not retained in product analytics; security logs use short retention and access controls.

## 20. Quotas and media

| Asset                  |         Limit |
| ---------------------- | ------------: |
| Avatar/logo            |          2 MB |
| Banner                 |          8 MB |
| Post image             |         10 MB |
| Attachment             |         25 MB |
| Images per post        |            30 |
| Attachments per post   |            10 |
| Standard project quota |          1 GB |
| 5% project quota       |          5 GB |
| Hosted video           | Not supported |

Images are decoded/re-encoded, metadata stripped and variants generated. SVG is sanitised or rasterised. Executables, package files and arbitrary HTML are rejected in beta.

## 21. Internationalisation

Initial interface locales:

- `en-GB` source.
- `de`.
- `fr`.
- `es`.
- `pt-BR`.

All strings use message keys, ICU pluralisation, locale-aware dates/numbers and RTL-safe layout primitives. Project-authored content is not automatically translated.

## 22. Acceptance metrics for beta

- A verified project can reach a live support page in under 15 minutes excluding Stripe verification time.
- A guest can complete a one-off support flow in under two minutes.
- A settled payment appears in dashboard and ledger within 30 seconds at p95.
- Entitlement and Discord role are applied within 60 seconds at p95.
- No entitlement is granted solely from a browser redirect.
- Public project pages achieve p75 LCP below 2.0 seconds on a mid-tier mobile connection.
- All primary workflows are keyboard-complete and pass automated accessibility checks plus manual screen-reader review.
