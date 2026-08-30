# 08 — Paperlight design system

## 1. Design system goals

- Preserve the warm Paperlight identity without sacrificing dense, efficient dashboards.
- Keep public project pages expressive and dashboards task-first.
- Encode light/dark/contrast behaviour in semantic tokens.
- Build every component once in Svelte + StyleX with accessible primitives. Static recipes live in `*.stylex.ts`; global CSS is limited to document-level rules.
- Avoid a card around every piece of content.

Canonical and generated token sources are in:

- `../packages/design-tokens/tokens.json` (canonical)
- `../packages/design-tokens/src/paperlight.stylex.ts` (runtime StyleX variables/themes)
- `assets/design-tokens.json` and `assets/stylex-tokens.ts` (documentation snapshots)

## 2. Layout system

8 px base rhythm with 4 px half-step.

Widths:

```text
reading content   70ch
public content    80rem
dashboard         96rem
sidebar           16rem
```

Breakpoints are content-driven rather than device names:

- Compact: under 44rem.
- Medium: 44–72rem.
- Wide: over 72rem.
- Public navigation uses a content-driven 64rem sheet threshold at medium widths when translated labels and actions no longer fit one row; dashboard sidebars keep the 44rem compact threshold.

Public project page wide layout:

```text
hero identity + illustration
support composer (2/3) | goal (1/3)
tiers grid
updates | supporter wall | selected project stats
```

Dashboard wide layout:

```text
persistent side navigation | fluid workspace
```

On compact screens, navigation becomes a sheet; critical actions stay in a sticky bottom/action region only when it does not cover content.

## 3. Surfaces

Use four levels only:

1. Canvas.
2. Section/surface.
3. Raised card/popover.
4. Modal.

Public pages can have large unboxed editorial regions. Dashboard rows/tables use separators and grouping before resorting to nested cards.

No glassmorphism. Backdrop blur is limited to a transient mobile nav overlay if used at all.

## 4. Core components

### Button

Variants:

- Primary forest.
- Secondary paper/outline.
- Quiet text.
- Destructive.
- Icon.

Requirements:

- 44 px minimum height.
- Loading preserves width and announces state.
- No action exists only on hover.
- Primary button count is generally one per section.

### Amount selector

- One-off/monthly/annual segmented control.
- Preset grid plus custom field.
- Currency and localised-price hint.
- Selected tier summary.
- Fee/tip disclosure directly above final action.
- Keyboard arrow navigation within segmented controls.

### Tier card

- Clear cadence/price, reward hierarchy and entitlement duration.
- Selected state uses border, subtle tint and check—not scale or glow.
- “Most popular” is project controlled but visually restrained; oss.tips never invents it from payment data.
- Equal-height card rows only when content remains readable; otherwise natural height.

### Goal

- Text value and percentage always visible.
- Progress bar includes accessible value attributes.
- Deadline and basis (“before fees”, “active supporters”) explicit.
- Botanical accent is decorative and hidden from assistive tech.

### Data card

- Label, value, comparison and optional sparkline.
- Use tabular numerals.
- Comparison includes text/icon; red/green alone is prohibited.
- Clicking a card applies/drills into a filter only when affordance is explicit.

### Table

- Sticky header where useful.
- Column chooser on wide dense tables.
- Row actions in visible menu, keyboard accessible.
- Bulk selection only where a real bulk operation exists.
- Mobile becomes labelled rows, not horizontal microtext.

### Inbox/thread

- Bounded payment-context thread with project, amount/cadence and timestamp header.
- Quick reply templates plus custom text.
- Internal notes visually and semantically separate from supporter-visible messages.
- Block/report state.

### Empty state

Small botanical/landscape fragment, one sentence explaining why empty and one relevant action. No giant illustration that pushes action below the fold.

### Toast

Used for reversible/non-critical confirmation. Financial success/failure uses persistent inline/page state, not a disappearing toast.

## 5. Navigation

### Public

Wordmark, Explore, About, Docs, theme, Sign in. Pricing/fee explanation may appear as “How fees work” rather than generic SaaS Pricing.

### Project dashboard

Groups:

```text
Overview
Support: inbox, supporters, payments, memberships
Engage: posts, supporter wall, Discord
Grow: goals, analytics
Develop: webhooks, API keys, domains
Manage: team, Stripe, settings
```

Navigation badges show only actionable counts such as unanswered messages or failed integration jobs.

### Platform admin

Separate visual shell/status accent so the operator never confuses admin with a project dashboard. Critical actions require explicit project context in the header.

## 6. Forms

- Labels always visible above inputs.
- Help text precedes error text.
- Validate on blur/submit; do not shout while typing.
- Preserve user input on server errors.
- Monetary fields use locale display but canonical integer minor units.
- Destructive actions use typed confirmation only for genuinely irreversible actions, not routine cancellation.
- Stripe/KYC fields remain in Stripe embedded components.

## 7. Charts

- Prefer line/bar/stacked bar; avoid pie/donut beyond two or three simple proportions.
- Default range 30 days with clear timezone.
- One-off and recurring use forest/moss plus solid/dashed distinction.
- Tooltip keyboard reachable and values in a sibling table/summary.
- Avoid fake precision when currency conversion is estimated.
- Do not animate continuously.

## 8. Theme implementation

- `data-theme="light|dark"` on root plus system default.
- StyleX semantic variables switch through `createTheme`.
- Project accent colour is transformed into an accessible limited palette; it never replaces status colours or body text.
- Illustrations have light/dark variants or use theme-safe SVG colours.
- User choice stored locally and in account preference when signed in.

## 9. Microinteractions

Detailed motion inventory:

| Interaction        | Behaviour                                                |
| ------------------ | -------------------------------------------------------- |
| Primary press      | 1 px translate + .99 scale, 100 ms                       |
| Hover card/action  | border/ink shift; no floating card lift by default       |
| Tier select        | check draw + tint, 180 ms                                |
| Amount change      | value cross-fade/slide 4 px, 140 ms                      |
| Goal update        | bar grows once, 360 ms                                   |
| Support success    | open-seed sprout draws, 500 ms max                       |
| Copy API key       | icon changes to check and label “Copied”                 |
| Optimistic setting | switch changes immediately, rolls back with inline error |
| Dashboard filter   | skeleton only for changed region, not whole page         |
| New inbox item     | subtle background wash that fades after focus            |

No cursor-following effects, parallax, floating blobs, decorative autoplay or scroll-jacking.

## 10. Content editor

Use a source-first Markdown editor with the domain Markdown AST as its parse/serialize boundary:

- Toolbar visible but compact.
- Slash menu optional, not required.
- Code language picker.
- Paste image uploads to quarantine and inserts placeholder/progress.
- Embed paste recognises only allowlisted URLs.
- Side-by-side or instant preview at target visibility/tier.
- Markdown source mode remains the primary accessible editing surface in beta; toolbar actions edit the canonical source.
- Autosave locally and server draft with version/conflict handling.
- Word/character counts only where useful.

## 11. Responsive behaviour

Public:

- Hero illustration becomes a shorter panoramic crop.
- Support composer follows project identity before secondary content.
- Tiers stack; selected support action can be sticky after a tier choice.
- Supporter wall truncates messages with accessible expansion.

Dashboard:

- Sidebar becomes a searchable navigation sheet.
- Metric cards use 2-column then 1-column grid.
- Charts keep a minimum useful height and offer table alternative.
- Financial tables become transaction cards with amount/status visible first.
- All actions remain available; no “desktop only” administration.

## 12. Accessibility quality gates

- axe/Playwright on all route templates.
- Story/component checks for keyboard/focus/contrast.
- Manual NVDA/VoiceOver pass on onboarding, checkout shell, dashboard, editor and supporter thread.
- 200% zoom and 320 CSS px layout test.
- Reduced motion and forced colours/high contrast test.
- All charts and progress controls have textual equivalents.
- Locale expansion test at 30–40% longer strings and RTL smoke test even before an RTL translation ships.

## 13. Design review checklist

Reject a screen when it:

- Uses more than one dominant primary action in one region.
- Hides a fee, renewal or entitlement term.
- Uses a decorative illustration behind critical text.
- Creates nested cards three levels deep.
- Adds motion without communicating state.
- Depends on hover.
- Uses generic SaaS copy or fake social proof.
- Displays a chart without a decision/action.
- Looks materially different in dark mode rather than intentionally themed.
