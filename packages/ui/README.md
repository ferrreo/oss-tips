# @oss-tips/ui Storybook

Paperlight design system components and **every** product page composition.

## Run

```bash
pnpm storybook
# or
pnpm --filter @oss-tips/ui storybook
```

## Page coverage

Stories live next to each page as `*.stories.ts`:

| Group | Path | Routes covered |
|---|---|---|
| Public | `src/pages/public/` | `/`, explore, about, pricing, docs, security, transparency, terms, project pages, sign-in, checkout success, claim, reply |
| Supporter | `src/pages/supporter/` | `/me/*` |
| Project dashboard | `src/pages/project/` + `dashboard/` aliases | `/dashboard/[project]/*` |
| Admin | `src/pages/admin/` | `/admin/*` |

Use the toolbar theme control for light/dark (`data-theme`).
