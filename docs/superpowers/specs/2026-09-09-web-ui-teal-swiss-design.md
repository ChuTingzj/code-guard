# CodeGuard Web UI Redesign — Teal Swiss (Visual Refresh)

**Date:** 2026-09-09  
**Status:** Approved for planning  
**Scope:** `apps/web` visual layer only  
**Approach:** A — Teal Swiss (light, minimal, brand teal retained)

## Goals

- Refresh the admin console look: colors, typography, spacing, surface/table styles.
- Keep daytime readability and the existing brand teal (`#0F766E`).
- Preserve routes, forms, API calls, drawer behavior, and chart data shapes.

## Non-goals

- Dark mode / theme toggle
- Information architecture changes
- New routes or features
- Replacing Recharts or adding UI libraries
- Backend / API changes

## Design principles

1. Light, high-contrast, low decoration (Minimalism & Swiss).
2. Teal reserved for brand and primary actions.
3. Verdict states use dedicated semantic colors plus text labels (not color alone).
4. Prefer borders and type hierarchy over heavy shadows or gradients.

## Design tokens

### Color

| Token | Hex | Role |
| --- | --- | --- |
| `brand` | `#0F766E` | Primary button, nav active, links |
| `brand-dark` | `#115E59` | Primary hover |
| `brand-light` | `#14B8A6` | Secondary accent / chart helper |
| `ink` | `#0F172A` | Primary text |
| `ink-muted` | `#64748B` | Secondary text, labels |
| `paper` | `#F8FAFC` | Page background (flat, no strong gradient) |
| `surface` | `#FFFFFF` | Cards, forms, panels |
| `border` | `#E2E8F0` | Borders, table dividers |
| `passed` | `#15803D` | PASSED |
| `warning` | `#B45309` | WARNING |
| `rejected` | `#B91C1C` | REJECTED |
| `ring` | `#0F766E` | Focus ring |

### Typography

| Role | Family | Usage |
| --- | --- | --- |
| Sans | IBM Plex Sans | Body, headings, UI chrome |
| Mono | JetBrains Mono | KPI values, verdicts, webhook/secret snippets |

- Remove `Source Serif 4` as display font.
- Page title ≈ `1.75rem` / weight 600; body 14–16px; labels 12–13px muted.

### Shape & elevation

- Control radius: `6px`
- Card radius: `10px`
- Card shadow: always apply `0 1px 2px rgba(15, 23, 42, 0.04)` (subtle; no multi-layer shadows)
- Transitions: 150–200ms on hover/focus
- Honor `prefers-reduced-motion`

## Component visual rules

### Shell / sidebar (`(main)/layout`)

- Surface sidebar with right border; sticky brand block.
- Active nav: light teal wash + `brand` text.
- Inactive nav: `ink-muted`; hover soft surface tint.

### Page header

- `h1` + one muted subtitle; optional trailing actions (e.g. range chips) aligned end.

### Surfaces

- Cards / sections: `bg-surface`, `border-border`, light shadow, consistent padding (`p-5`).
- Error banners: soft red wash + `rejected` text + left accent border.

### Controls

- Primary button: `brand` fill, white text, `brand-dark` hover.
- Secondary button / chips (inactive): white + border.
- Inputs / selects: white, border, `focus:ring-2` with `ring`.
- Tables: muted header text; row dividers; subtle row hover.
- Empty states: centered short message (copy polish only).

### Charts

- Keep Recharts components and data contracts.
- Align stroke/fill with tokens (`brand`, `brand-light`, ink-muted grids).
- Do not rely on color alone for meaning where labels already exist.

## Page application map

| Page | Visual changes |
| --- | --- |
| Login | Centered surface card; brand in sans; tokenized inputs/button |
| Main layout | Nav active styles; tighter brand block |
| Dashboard | Mono KPI numbers; unified card/chart shells; range chips |
| Projects | Form + list surfaces unified |
| Knowledge base | Same surface/control language |
| Review logs | Filters + table + drawer chrome aligned to tokens |

## Implementation touchpoints (expected)

- `apps/web/tailwind.config.js` — extend tokens (surface, border, ink-muted, mono)
- `apps/web/app/globals.css` — flat paper background; focus/reduced-motion helpers
- `apps/web/app/layout.tsx` — font imports (Plex + JetBrains Mono); drop Source Serif
- Page/layout/component class updates under `apps/web/app/**` and `apps/web/components/**`

No new npm dependencies beyond Google Fonts stylesheet usage already in pattern.

## Acceptance criteria

- [ ] All listed pages render with light Teal Swiss tokens
- [ ] No Source Serif usage remains
- [ ] Focus rings visible on interactive controls
- [ ] Verdict colors still distinguishable with text labels
- [ ] Routes, form fields, and API behavior unchanged
- [ ] Usable at ~375px width (tables scroll horizontally where needed)
- [ ] No dark-mode requirement

## Out of scope leftovers

Any shell redesign (top bar, mobile nav drawer) or IA changes belong to a later “shell + components” pass, not this visual refresh.
