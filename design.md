<!-- Hallmark · pre-emit critique: P5 H5 E4 S5 R5 V4 -->

# OSS Tips design system

`oss.tips` is the product and brand. Paperlight is its visual system. This file locks the existing brand kit into one implementation contract for all public, supporter, project-dashboard, and admin surfaces.

## Product voice

- Audience: open-source maintainers, supporters, and platform operators.
- Use: fund and manage open-source projects with clear financial terms.
- Tone: warm, direct, technically precise, and honest.
- Product name: always `oss.tips`, lowercase, with the dot.
- Strapline: “Open source thrives with you.”
- Never invent rankings, testimonials, customer logos, project art, or financial proof.

## Visual system

- Theme: custom Paperlight, with light and dark parity.
- Display: Newsreader. UI: Source Sans 3. Technical/data: IBM Plex Mono.
- Palette: warm paper, botanical forest/moss/fern, restrained ochre, tinted ink. Semantic status colours never depend on colour alone.
- Rhythm: 8px base with a 4px half-step.
- Focus: 2px high-contrast ring with 3px offset.
- Illustration: approved watercolor/gouache landscapes and botanical fragments only. No stock people, aurora gradients, glass, floating blobs, or fake project artwork.

## Page families

- Public discovery and project pages: Ecosystem Index. Editorial identity, split hero, open section rhythm, project proof before calls to action.
- Project, supporter, and admin workspaces: Workbench. Task-first navigation, compact tables/data views, minimal decorative art.
- Documentation, policies, security, and transparency: Long Document. Reading measure, strong heading hierarchy, restrained rules.
- Navigation: N1b with the four real destinations plus theme and sign-in.
- Footer: Ft1 mast-headed, not a generic multi-column sitemap.

## Responsive contract

- Compact: below 44rem. Medium: 44–72rem. Wide: above 72rem.
- Public navigation and app sidebars become native modal navigation sheets on compact screens.
- Public navigation may use a content-driven 64rem sheet threshold at medium widths when translated labels and actions no longer fit one row; app sidebars remain sheets below 44rem.
- All layouts pass at 320 CSS px and 200% zoom without horizontal page overflow.
- Tables become labelled rows/cards where horizontal scrolling would hide primary amount or status information.
- Long identifiers and repository URLs wrap without shrinking marks or controls.

## Motion

- Maximum three recurring primitives: button press, selection/progress change, navigation-sheet open/close.
- Motion communicates state. Nothing floats, follows the pointer, scroll-jacks, or loops decoratively.
- Spatial motion uses transform/opacity and stops under `prefers-reduced-motion`.
- Focus rings appear instantly and never animate.

## Components and stories

- Pages compose reusable controls, shells, cards, data views, and coherent section components. Do not create wrapper components that only rename a single element.
- Every production Svelte component has a direct Storybook story.
- Every page has realistic fixture-driven stories for each meaningful state: populated, empty, loading, error, restricted/permission, and success where those states exist.
- Interactive components demonstrate default, hover, focus-visible, active, disabled, loading, error, and success states where semantically applicable.
- Every story is reviewed in light/dark and at 320, 768, and 1280 widths. Core flows include keyboard interaction and axe checks.

## StyleX implementation

- `packages/design-tokens/tokens.json` is the semantic token source. `paperlight.stylex.ts` exposes StyleX variables and the dark theme.
- Put static component and page recipes in `*.stylex.ts` files. Svelte files consume them with `stylex.attrs`.
- Keep global CSS only for document reset, font loading, body defaults, print/forced-colour rules, and third-party/browser-owned elements.
- Inline `style` is allowed only for genuinely dynamic geometry or CSS custom-property values that cannot be known at build time.
- Use native platform primitives before adding dependencies: dialog for modal navigation, semantic buttons/inputs/tables, and CSS for restrained transitions.

## Exports

### CSS

The complete runtime-neutral CSS export is [tokens.css](./tokens.css).

### Tailwind v4

```css
@theme {
  --color-paper: oklch(97.7% 0.0114 84.6);
  --color-paper-2: oklch(95.38% 0.016 82.8);
  --color-paper-3: oklch(94.97% 0.0209 88.7);
  --color-ink: oklch(27.09% 0.0222 155.5);
  --color-ink-2: oklch(49.82% 0.0211 142.7);
  --color-rule: oklch(87.53% 0.0221 83.3);
  --color-muted: oklch(50.84% 0.0164 138.7);
  --color-accent: oklch(43.14% 0.0765 151);
  --color-focus: oklch(43.14% 0.0765 151);
  --font-display: Newsreader, 'EB Garamond', Georgia, serif;
  --font-body: 'Source Sans 3', Inter, system-ui, sans-serif;
  --font-outlier: 'IBM Plex Mono', ui-monospace, monospace;
  --spacing-3xs: 0.25rem;
  --spacing-2xs: 0.5rem;
  --spacing-xs: 0.75rem;
  --spacing-sm: 1rem;
  --spacing-md: 1.5rem;
  --spacing-lg: 2rem;
  --spacing-xl: 3rem;
  --radius-card: 0.875rem;
  --radius-pill: 9999px;
  --radius-input: 0.625rem;
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in: cubic-bezier(0.7, 0, 0.84, 0);
  --ease-in-out: cubic-bezier(0.65, 0, 0.35, 1);
}
```

### DTCG

```json
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "color": {
    "paper": { "$value": "oklch(97.7% 0.0114 84.6)", "$type": "color" },
    "paper-2": { "$value": "oklch(95.38% 0.016 82.8)", "$type": "color" },
    "ink": { "$value": "oklch(27.09% 0.0222 155.5)", "$type": "color" },
    "ink-2": { "$value": "oklch(49.82% 0.0211 142.7)", "$type": "color" },
    "rule": { "$value": "oklch(87.53% 0.0221 83.3)", "$type": "color" },
    "accent": { "$value": "oklch(43.14% 0.0765 151)", "$type": "color" },
    "focus": { "$value": "oklch(43.14% 0.0765 151)", "$type": "color" }
  },
  "font": {
    "display": { "$value": "Newsreader, EB Garamond, Georgia, serif", "$type": "fontFamily" },
    "body": { "$value": "Source Sans 3, Inter, system-ui, sans-serif", "$type": "fontFamily" },
    "outlier": { "$value": "IBM Plex Mono, ui-monospace, monospace", "$type": "fontFamily" }
  },
  "space": {
    "3xs": { "$value": "0.25rem", "$type": "dimension" },
    "2xs": { "$value": "0.5rem", "$type": "dimension" },
    "xs": { "$value": "0.75rem", "$type": "dimension" },
    "sm": { "$value": "1rem", "$type": "dimension" },
    "md": { "$value": "1.5rem", "$type": "dimension" },
    "lg": { "$value": "2rem", "$type": "dimension" },
    "xl": { "$value": "3rem", "$type": "dimension" }
  },
  "duration": {
    "micro": { "$value": "80ms", "$type": "duration" },
    "short": { "$value": "140ms", "$type": "duration" },
    "long": { "$value": "360ms", "$type": "duration" }
  }
}
```

### shadcn/ui

```css
:root {
  --background: 97.7% 0.0114 84.6;
  --foreground: 27.09% 0.0222 155.5;
  --card: 99.42% 0.0069 88.6;
  --card-foreground: 27.09% 0.0222 155.5;
  --primary: 43.14% 0.0765 151;
  --primary-foreground: 97.7% 0.0114 84.6;
  --secondary: 94.97% 0.0209 88.7;
  --secondary-foreground: 27.09% 0.0222 155.5;
  --muted: 95.38% 0.016 82.8;
  --muted-foreground: 49.82% 0.0211 142.7;
  --border: 87.53% 0.0221 83.3;
  --input: 87.53% 0.0221 83.3;
  --ring: 43.14% 0.0765 151;
  --destructive: 51.43% 0.1255 28.4;
  --destructive-foreground: 97.7% 0.0114 84.6;
  --radius: 0.875rem;
}
```
