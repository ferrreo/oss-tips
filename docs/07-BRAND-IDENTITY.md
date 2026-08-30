# 07 — Brand identity: Paperlight

## 1. Chosen direction

The final identity is **Paperlight** in light and dark modes, based on the two selected mockups in `assets/`.

Paperlight deliberately avoids the rejected directions:

- Not neon, orbital or “AI startup”.
- Not corporate blue SaaS slopware.
- Not retro-terminal cosplay.
- Not glassy pastel gradient product-design fashion.
- Not faux-minimalism with no personality.

It combines **editorial warmth**, **developer precision** and **financial transparency**.

## 2. Brand idea

Open source is infrastructure grown and maintained over time. Funding should feel less like a transaction feed and more like sustaining a living commons.

The visual metaphor is **rooted growth**:

- Paper: documentation, source, openness and history.
- Forest/landscape: ecosystems, interdependence and durability.
- Open seed mark: open source, a contribution entering the commons and growth without enclosure.
- Fine technical lines: accurate systems beneath a human surface.

## 3. Name and writing

Primary name: `oss.tips`

- Always lowercase in product copy and wordmark.
- Keep the dot.
- Spoken as “O-S-S tips”.
- Do not expand OSS in the logo.
- In prose, “oss.tips” takes normal sentence grammar: “oss.tips helps projects…”

Primary strapline:

> Open source thrives with you.

Supporting lines:

- Direct support for the tools you rely on.
- Sustainable projects. Stronger communities.
- Fund the software that keeps the world running.
- Clear support. No hidden platform balance.

Avoid “creators”, “content”, “monetise your audience”, “hustle”, “fans” and charity language for ordinary projects.

## 4. Logo system

Assets:

- `oss-tips-wordmark-light.svg/png`
- `oss-tips-wordmark-dark.svg/png`
- `oss-tips-mark-light.svg`
- `oss-tips-mark-dark.svg`
- `oss-tips-app-icon-light.svg`
- `oss-tips-app-icon-dark.svg`
- `favicon.svg`

### Open seed mark

The broken circular form means openness and continuity. The two small leaves form growth at the opening rather than closing the ring. The centre seed/point gives it a recognisable small-size anchor and subtly recalls a coin without becoming a currency symbol.

### Wordmark

Lowercase editorial serif. `oss.` uses ink; `tips` uses forest green. Dark mode changes these to paper and fern green.

### Clear space

Minimum clear space is the diameter of the centre seed around every side of the mark, or the cap height of the lowercase `o` around the wordmark.

### Minimum size

- Mark: 20 CSS px; use simplified single-colour rendering below 24 px if necessary.
- Horizontal wordmark: 96 CSS px wide.
- Never use the detailed landscape illustration as the favicon.

### Misuse

Do not:

- Apply a neon gradient.
- Put the logo inside a generic pill.
- Add drop shadows or glow.
- Replace the dot with a heart/coin.
- Stretch, rotate or outline the wordmark.
- Put the dark logo on a low-contrast photo.
- use uppercase `OSS.TIPS` as the primary mark.

## 5. Colour

### Light theme

| Token        | Hex       | Role                      |
| ------------ | --------- | ------------------------- |
| Paper        | `#FBF7EF` | page canvas               |
| Paper raised | `#FFFDF8` | cards/dialogues           |
| Parchment    | `#F4EEDF` | secondary panels          |
| Ink          | `#1E2A22` | primary text              |
| Muted ink    | `#5C665B` | accessible secondary text |
| Faint ink    | `#61685F` | accessible metadata text  |
| Forest       | `#2D5C3A` | primary action/brand      |
| Deep forest  | `#244A30` | hover/pressed             |
| Moss         | `#7C8A5B` | secondary brand/data      |
| Fern         | `#A8B59A` | soft fill/illustration    |
| Ochre        | `#B88747` | highlights/rewards        |
| Rule         | `#DDD5C6` | borders/dividers          |
| Danger       | `#A3463C` | destructive/error         |

### Dark theme

| Token        | Hex       | Role                      |
| ------------ | --------- | ------------------------- |
| Night        | `#11130F` | page canvas               |
| Night raised | `#171A15` | cards                     |
| Canopy       | `#1D211B` | elevated panels           |
| Paper text   | `#EDE7D8` | primary text              |
| Muted paper  | `#B4B1A3` | accessible secondary text |
| Faint paper  | `#8E9084` | accessible metadata text  |
| Fern action  | `#91A66E` | primary brand/action      |
| Bright fern  | `#A5BA82` | hover                     |
| Moss         | `#71834F` | secondary brand/data      |
| Ochre        | `#C6A36B` | highlights/rewards        |
| Rule         | `#34382E` | borders/dividers          |
| Danger       | `#D47A6E` | destructive/error         |

Use semantic tokens rather than raw colour names in components. Green is not automatically “success”; ochre is not automatically “warning”. Status colours must include icon/text, never colour alone.

Moss and ochre are decorative/data-series colours, not normal-size text colours. The semantic muted text values above are deliberately darker/lighter than the original swatches so secondary copy meets WCAG AA on Paperlight surfaces.

## 6. Typography

Recommended web families, all open-source:

### Display/editorial — Newsreader

Use for landing headlines, project hero headings, section titles and selected monetary figures. Its warm editorial voice creates the paper/document feel without looking antique.

Fallback: EB Garamond, Georgia, serif.

### Interface — Source Sans 3

Use for navigation, buttons, forms, tables and dense dashboards. It is neutral, readable and less generic than default startup typography.

Fallback: Inter, system-ui, sans-serif.

### Technical — IBM Plex Mono

Use sparingly for repository names, webhook event types, API examples, transaction references and code.

Do not set whole dashboards in monospace.

### Type behaviour

- Display headlines: tight line-height around 0.98–1.08, restrained negative tracking.
- Body: 1.5–1.65 line-height.
- UI: 14–16 px minimum; dense tables may use 13 px only with adequate line height.
- Monetary values use tabular numerals.
- All-caps only for small overlines with generous tracking, never buttons or paragraphs.

## 7. Illustration

Style:

- Watercolour/gouache-inspired landscapes and botanical fragments.
- Visible paper grain at very low contrast.
- Simplified shapes, natural asymmetry and a limited palette.
- Technical diagrams may overlay fine rules/grid points, but no sci-fi HUD treatment.

Use illustration at:

- Home/project hero.
- Empty states.
- Goal completion.
- Onboarding milestones.
- Footer/sign-off areas.

Do not use it behind dense dashboard data, form labels or critical warnings. The interface must remain legible if all illustration fails to load.

Project art may replace the default landscape within safe crops. Never auto-generate fake project artwork.

## 8. Iconography

- 1.5–1.75 px rounded strokes at 20/24 px grid.
- Mostly outline; filled state for selected nav or status.
- Small botanical/reward illustrations are separate from functional icons.
- Use a consistent open-source icon set as a base, then draw custom money/goal/support glyphs to match.
- Emoji are user content, not the application icon system.

## 9. Shape and surface

- Corners are softly practical: 10–14 px for cards, 8–10 px for controls.
- No universal giant 24 px pill/card radius.
- Pills are reserved for tags, status and segmented controls.
- Light mode uses paper/ink boundaries and quiet shadows.
- Dark mode uses tonal layers and fine borders rather than black cards floating on black.
- Subtle grain may be one tiny optimised asset at 1–2% opacity; never animate it.

## 10. Motion

Motion communicates cause and state:

- Button press: 1 px downward movement and slight scale, 80–140 ms.
- Tier selection: border/fill transition and checkmark draw, about 180 ms.
- Goal progress: animate only after data arrives, 300–500 ms, once.
- Successful support: restrained seed-to-sprout flourish; no confetti storm.
- Dashboard number changes: cross-fade/short roll only when triggered by user filter.
- Drawer/dialogue: opacity plus 8 px translation, not large spring movement.

Respect `prefers-reduced-motion`: remove transforms and use instant/cross-fade state changes.

## 11. Voice and tone

### Baseline

Direct, warm, technically literate and honest.

Good:

- “£10 goes to Rust before Stripe processing fees.”
- “Your membership renews yearly. You can cancel at any time.”
- “This project receives payments through its own Stripe account.”
- “We’re still processing this bank payment. Rewards unlock after it settles.”

Bad:

- “Fuel their dreams!”
- “Supercharge your creator journey.”
- “Zero fees!” when Stripe or recurring fees exist.
- “Donation” for every paid membership.
- “Anonymous crypto” where provider/blockchain records exist.

### Errors

State what happened, what did not happen and the next action. Never imply a failed client redirect means payment failed; check provider state.

### Admin/security

Calm and precise. Avoid cute copy around refunds, disputes, account restrictions or abuse.

## 12. Photography and project media

Prefer real project logos, screenshots, diagrams, maintainers at events and hardware/software in context. Do not use stock photos of generic teams at laptops. Keep the platform’s own landscapes illustrative so they do not compete with project media.

## 13. Accessibility

- All colour pairs meet WCAG 2.2 AA; large display text still aims for AA.
- Body text never appears directly over detailed illustration without a solid/graded backing.
- Focus state is a 2 px high-contrast ring with 3 px offset.
- Minimum target 44×44 px.
- Charts have table/text alternatives and distinguish series by shape/dash, not colour alone.
- Theme follows system by default and can be explicitly overridden.

## 14. Brand file status

The supplied SVGs are production-suitable starting assets and use vector paths for the wordmark. Before broad launch, perform one manual lettering pass in a vector editor to refine kerning and register the final logo version, but no further conceptual exploration is required unless the name changes.
