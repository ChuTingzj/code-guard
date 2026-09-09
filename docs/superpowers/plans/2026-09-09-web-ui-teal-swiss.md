# CodeGuard Web UI Teal Swiss Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply the approved Teal Swiss visual refresh across `apps/web` (tokens, typography, surfaces, controls) without changing routes, forms, APIs, or chart data contracts.

**Architecture:** Extend Tailwind theme tokens and shared `@layer components` utilities in `globals.css`, then replace ad-hoc `bg-white/80` / `text-slate-*` / `font-display` (serif) classes page-by-page. Add a tiny client `AppNav` only so the sidebar can show an active state. Keep all server actions and fetch logic untouched.

**Tech Stack:** Next.js App Router, React 18, Tailwind CSS 3, Recharts, Google Fonts (IBM Plex Sans + JetBrains Mono)

**Spec:** `docs/superpowers/specs/2026-09-09-web-ui-teal-swiss-design.md`

## Global Constraints

- Light theme only — no dark mode
- Brand primary stays `#0F766E`
- Visual layer only — no route/API/form-field/behavior changes
- No new npm dependencies (fonts via existing Google Fonts `<link>` pattern)
- Card radius `10px`, control radius `6px`, card shadow `0 1px 2px rgba(15, 23, 42, 0.04)`
- Remove `Source Serif 4` entirely
- Honor `prefers-reduced-motion`
- Focus rings: `ring-2` with token `ring` (`#0F766E`)

---

## File map

| File | Responsibility |
| --- | --- |
| `apps/web/tailwind.config.js` | Semantic color/radius/shadow/font tokens |
| `apps/web/app/globals.css` | Flat paper bg, component utilities, reduced-motion, verdict colors |
| `apps/web/app/layout.tsx` | Font imports + body classes |
| `apps/web/components/shell/app-nav.tsx` | Client sidebar nav with active route |
| `apps/web/app/(main)/layout.tsx` | Shell chrome using tokens + `AppNav` |
| `apps/web/app/(auth)/login/page.tsx` | Login surface styling |
| `apps/web/app/(main)/dashboard/page.tsx` | KPI/cards/chips styling |
| `apps/web/components/charts/trend-chart.tsx` | Chart stroke/fill/grid colors |
| `apps/web/app/(main)/projects/page.tsx` | Form + list surfaces |
| `apps/web/app/(main)/knowledge-base/page.tsx` | Upload/list surfaces |
| `apps/web/components/knowledge/document-list-poll.tsx` | List + status pills |
| `apps/web/app/(main)/review-logs/page.tsx` | Filters + header |
| `apps/web/components/reviews/review-logs-client.tsx` | Table surface |
| `apps/web/components/reviews/review-detail-drawer.tsx` | Drawer chrome |

---

### Task 1: Design tokens + global utilities

**Files:**
- Modify: `apps/web/tailwind.config.js`
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/layout.tsx`
- Test: shell grep + `pnpm --filter @code-guard/web exec tsc --noEmit` (if configured) or build

**Interfaces:**
- Consumes: none
- Produces: Tailwind tokens `surface`, `border`, `ink`, `ink-muted`, `paper`, `ring`, `shadow-card`, `rounded-card`, `rounded-control`, `font-mono`, `font-display`→sans; CSS utilities `.ui-surface`, `.ui-input`, `.ui-btn-primary`, `.ui-btn-secondary`, `.ui-page-title`, `.ui-page-subtitle`, `.ui-error`, `.ui-table-wrap`

- [ ] **Step 1: Write acceptance grep checklist (failing before changes)**

Run:

```bash
cd /Users/Admin/Project/code-guard
rg -n "Source Serif" apps/web || true
rg -n "fontFamily:.*display" apps/web/tailwind.config.js
```

Expected (current baseline): `Source Serif` / serif display still present — this is the pre-change signal.

- [ ] **Step 2: Replace `apps/web/tailwind.config.js` with tokenized theme**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0F766E',
          dark: '#115E59',
          light: '#14B8A6',
        },
        ink: {
          DEFAULT: '#0F172A',
          muted: '#64748B',
        },
        paper: '#F8FAFC',
        surface: '#FFFFFF',
        border: '#E2E8F0',
        ring: '#0F766E',
        passed: '#15803D',
        warning: '#B45309',
        rejected: '#B91C1C',
      },
      borderRadius: {
        control: '6px',
        card: '10px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(15, 23, 42, 0.04)',
      },
      fontFamily: {
        display: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['"IBM Plex Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      transitionDuration: {
        ui: '180ms',
      },
    },
  },
  plugins: [],
};
```

- [ ] **Step 3: Replace `apps/web/app/globals.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --brand: #0f766e;
  --passed: #15803d;
  --warning: #b45309;
  --rejected: #b91c1c;
}

@layer base {
  body {
    @apply bg-paper text-ink antialiased;
  }

  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }
}

@layer components {
  .ui-page-title {
    @apply text-[1.75rem] font-semibold tracking-tight text-ink;
  }

  .ui-page-subtitle {
    @apply mt-1 text-sm text-ink-muted;
  }

  .ui-surface {
    @apply rounded-card border border-border bg-surface p-5 shadow-card;
  }

  .ui-input {
    @apply w-full rounded-control border border-border bg-surface px-3 py-2 text-sm text-ink outline-none transition duration-ui focus:ring-2 focus:ring-ring;
  }

  .ui-btn-primary {
    @apply cursor-pointer rounded-control bg-brand px-4 py-2 text-sm font-medium text-white transition duration-ui hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50;
  }

  .ui-btn-secondary {
    @apply cursor-pointer rounded-control border border-border bg-surface px-3 py-1.5 text-sm text-ink transition duration-ui hover:bg-paper;
  }

  .ui-error {
    @apply rounded-control border-l-4 border-rejected bg-red-50 px-4 py-3 text-sm text-rejected;
  }

  .ui-table-wrap {
    @apply overflow-x-auto rounded-card border border-border bg-surface shadow-card;
  }

  .ui-nav-link {
    @apply block cursor-pointer rounded-control px-3 py-2 text-sm text-ink-muted transition duration-ui hover:bg-paper hover:text-ink;
  }

  .ui-nav-link-active {
    @apply bg-teal-50 text-brand hover:bg-teal-50 hover:text-brand;
  }
}

.verdict-passed {
  @apply font-mono text-sm font-medium text-passed;
}
.verdict-warning {
  @apply font-mono text-sm font-medium text-warning;
}
.verdict-rejected {
  @apply font-mono text-sm font-medium text-rejected;
}
```

- [ ] **Step 4: Update `apps/web/app/layout.tsx` fonts**

Replace the Google Fonts link and body classes:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CodeGuard AI',
  description: '面向研发团队的全自动代码审查助手',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
```

- [ ] **Step 5: Verify Source Serif removed from foundation**

Run:

```bash
rg -n "Source Serif" apps/web
```

Expected: no matches (or only in docs outside `apps/web` — within `apps/web` must be empty).

Run:

```bash
pnpm --filter @code-guard/web build
```

Expected: build succeeds (or at least compiles CSS/TS without token errors). If `dev` is already running, a hard refresh is enough to spot paper background flattening.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tailwind.config.js apps/web/app/globals.css apps/web/app/layout.tsx
git commit -m "$(cat <<'EOF'
style(web): add Teal Swiss design tokens and UI utilities

EOF
)"
```

---

### Task 2: Shell layout + active nav

**Files:**
- Create: `apps/web/components/shell/app-nav.tsx`
- Modify: `apps/web/app/(main)/layout.tsx`
- Test: open `/dashboard`, `/projects` and confirm active nav highlight

**Interfaces:**
- Consumes: `.ui-nav-link`, `.ui-nav-link-active`, tokens from Task 1
- Produces: `AppNav` client component used by main layout

- [ ] **Step 1: Create `apps/web/components/shell/app-nav.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV = [
  { href: '/dashboard', label: '质量大盘' },
  { href: '/projects', label: '项目管理' },
  { href: '/knowledge-base', label: '规范知识库' },
  { href: '/review-logs', label: '审查日志' },
];

export function AppNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-1" aria-label="主导航">
      {NAV.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`ui-nav-link ${active ? 'ui-nav-link-active' : ''}`}
            aria-current={active ? 'page' : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Replace `apps/web/app/(main)/layout.tsx`**

```tsx
import Link from 'next/link';
import { AppNav } from '@/components/shell/app-nav';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl gap-0 px-4 py-6 md:gap-8 md:px-8">
      <aside className="hidden w-56 shrink-0 border-r border-border pr-6 md:block">
        <div className="sticky top-6 space-y-6">
          <div>
            <Link href="/dashboard" className="text-xl font-semibold tracking-tight text-brand">
              CodeGuard
            </Link>
            <p className="mt-1 text-xs text-ink-muted">AI 审查助手</p>
          </div>
          <AppNav />
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-16 md:pl-0">{children}</main>
    </div>
  );
}
```

- [ ] **Step 3: Manual verify**

With `pnpm dev` (or existing web on :3000), visit `/dashboard` then `/projects`.

Expected: active item uses teal wash + brand text; brand uses sans (not serif); sidebar has right border.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/shell/app-nav.tsx apps/web/app/\(main\)/layout.tsx
git commit -m "$(cat <<'EOF'
style(web): restyle main shell with active nav

EOF
)"
```

---

### Task 3: Login page

**Files:**
- Modify: `apps/web/app/(auth)/login/page.tsx`
- Test: visual check `/login`

**Interfaces:**
- Consumes: `.ui-surface`, `.ui-input`, `.ui-btn-primary`, `.ui-error`
- Produces: none (page-only)

- [ ] **Step 1: Update login markup classes (keep all logic identical)**

Replace the `return (` JSX with:

```tsx
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
      <div className="ui-surface">
        <div className="mb-8">
          <p className="text-3xl font-semibold tracking-tight text-brand">CodeGuard</p>
          <p className="mt-2 text-sm text-ink-muted">研发团队全自动代码审查助手</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">邮箱</span>
            <input
              className="ui-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              autoComplete="username"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-ink-muted">密码</span>
            <input
              className="ui-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error ? <p className="ui-error">{error}</p> : null}
          <button type="submit" disabled={loading} className="ui-btn-primary w-full py-2.5">
            {loading ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </main>
  );
```

Do **not** change `onSubmit`, state, or fetch URL.

- [ ] **Step 2: Verify**

Open `/login`. Expected: white card on flat paper; focus ring on inputs; primary teal button.

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/\(auth\)/login/page.tsx
git commit -m "$(cat <<'EOF'
style(web): apply Teal Swiss login surface

EOF
)"
```

---

### Task 4: Dashboard + charts

**Files:**
- Modify: `apps/web/app/(main)/dashboard/page.tsx`
- Modify: `apps/web/components/charts/trend-chart.tsx`
- Test: visual `/dashboard`

**Interfaces:**
- Consumes: `.ui-surface`, `.ui-page-title`, `.ui-page-subtitle`, `.ui-error`, `.ui-btn-primary`, `.ui-btn-secondary`, `font-mono`
- Produces: none

- [ ] **Step 1: Update dashboard page classes**

Keep data fetching identical. Replace the returned JSX structure classes as follows:

- Outer: `space-y-8`
- Header `h1`: `ui-page-title` (drop `font-display text-3xl font-bold`)
- Subtitle: `ui-page-subtitle`
- Error: `ui-error`
- Range active chip: `ui-btn-primary px-3 py-1.5`
- Range inactive chip: `ui-btn-secondary`
- KPI cards: `ui-surface px-5 py-4` (keep padding); label `text-xs uppercase tracking-wide text-ink-muted`; value `mt-2 font-mono text-3xl font-semibold tabular-nums`
- Chart/table sections: `ui-surface`
- Table head: `text-ink-muted`
- Table row border: `border-t border-border`
- Empty: `text-ink-muted`

Use `next/link` for range chips instead of raw `<a>` (Next.js guideline):

```tsx
import Link from 'next/link';
// ...
{['7d', '30d'].map((r) => (
  <Link
    key={r}
    href={`/dashboard?range=${r}`}
    scroll={false}
    className={range === r ? 'ui-btn-primary px-3 py-1.5' : 'ui-btn-secondary'}
  >
    {r}
  </Link>
))}
```

- [ ] **Step 2: Align chart colors to tokens in `trend-chart.tsx`**

```tsx
'use client';

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
} from 'recharts';

const GRID = '#E2E8F0';
const TICK = '#64748B';

export function TrendChart({
  data,
}: {
  data: Array<{ period: string; passed: number; warning: number; rejected: number }>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="period" tick={{ fontSize: 12, fill: TICK }} />
          <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: TICK }} />
          <Tooltip />
          <Line type="monotone" dataKey="passed" name="PASSED" stroke="#15803D" strokeWidth={2} />
          <Line type="monotone" dataKey="warning" name="WARNING" stroke="#B45309" strokeWidth={2} />
          <Line type="monotone" dataKey="rejected" name="REJECTED" stroke="#B91C1C" strokeWidth={2} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ViolationBar({
  data,
}: {
  data: Array<{ ruleTitle: string; count: number }>;
}) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart data={data} layout="vertical" margin={{ left: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis type="number" allowDecimals={false} tick={{ fill: TICK }} />
          <YAxis type="category" dataKey="ruleTitle" width={140} tick={{ fontSize: 11, fill: TICK }} />
          <Tooltip />
          <Bar dataKey="count" name="次数" fill="#0F766E" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Open `/dashboard`. Expected: mono KPI numbers; unified white cards; range chips; charts use brand/verdict colors; no serif titles.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(main\)/dashboard/page.tsx apps/web/components/charts/trend-chart.tsx
git commit -m "$(cat <<'EOF'
style(web): restyle dashboard and chart tokens

EOF
)"
```

---

### Task 5: Projects + knowledge base

**Files:**
- Modify: `apps/web/app/(main)/projects/page.tsx`
- Modify: `apps/web/app/(main)/knowledge-base/page.tsx`
- Modify: `apps/web/components/knowledge/document-list-poll.tsx`
- Test: visual `/projects`, `/knowledge-base`

**Interfaces:**
- Consumes: `.ui-*` utilities from Task 1
- Produces: none

- [ ] **Step 1: Restyle projects page (logic unchanged)**

Apply:

- Titles: `ui-page-title` / `ui-page-subtitle`
- Error: `ui-error`
- Sections: `ui-surface`
- Inputs/selects: `ui-input` (for grid cells use `ui-input` without forcing full width conflict — `ui-input` already has `w-full`)
- Submit: `ui-btn-primary md:col-span-2`
- List meta: `text-ink-muted`
- Enabled pill: `rounded-control bg-emerald-50 px-2 py-0.5 text-xs font-medium text-passed` (use `rounded-control`, not `rounded-full`)
- Disabled pill: `rounded-control bg-paper px-2 py-0.5 text-xs text-ink-muted`
- Empty: `text-ink-muted`
- Secret line: wrap masked secret in `<span className="font-mono text-xs">…</span>`

- [ ] **Step 2: Restyle knowledge-base page**

Same surface/title/input/button utilities. Project switch links:

```tsx
<a key={p.id} className="ml-2 text-brand underline underline-offset-2 hover:text-brand-dark" href={`/knowledge-base?projectId=${p.id}`}>
```

Delete buttons stay text-only but:

```tsx
className="mr-3 cursor-pointer text-xs text-rejected underline underline-offset-2"
```

- [ ] **Step 3: Restyle `document-list-poll.tsx`**

- Dividers: `divide-border`
- Meta: `text-ink-muted`
- Empty: `text-ink-muted`
- `StatusPill`: use `rounded-control` + existing semantic colors; READY → `bg-emerald-50 text-passed`; FAILED → `bg-red-50 text-rejected`; else → `bg-amber-50 text-warning`

- [ ] **Step 4: Verify**

`/projects` and `/knowledge-base` show matching surfaces; forms have focus rings; no behavior change on create/upload/delete.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(main\)/projects/page.tsx apps/web/app/\(main\)/knowledge-base/page.tsx apps/web/components/knowledge/document-list-poll.tsx
git commit -m "$(cat <<'EOF'
style(web): restyle projects and knowledge base surfaces

EOF
)"
```

---

### Task 6: Review logs + detail drawer

**Files:**
- Modify: `apps/web/app/(main)/review-logs/page.tsx`
- Modify: `apps/web/components/reviews/review-logs-client.tsx`
- Modify: `apps/web/components/reviews/review-detail-drawer.tsx`
- Test: visual `/review-logs` + open a row

**Interfaces:**
- Consumes: `.ui-*`, `.verdict-*`
- Produces: none

- [ ] **Step 1: Restyle review-logs page**

- Header: `ui-page-title` / `ui-page-subtitle`
- Select: `ui-input w-auto`
- Filter button: `ui-btn-primary`

Keep `formAction="/review-logs"` and option values unchanged.

- [ ] **Step 2: Restyle `review-logs-client.tsx` table**

```tsx
      <div className="ui-table-wrap">
        <table className="w-full text-left text-sm">
          <thead className="text-ink-muted">
            ...
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer border-t border-border transition duration-ui hover:bg-paper"
                onClick={() => setSelected(item.id)}
              >
                ...
                <td className="px-4 py-3 text-ink-muted">...</td>
              </tr>
            ))}
            {!items.length ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-ink-muted">
                  暂无审查记录
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
```

Verdict spans keep `verdict-${...}` classes (now mono via globals).

- [ ] **Step 3: Restyle `review-detail-drawer.tsx` chrome only**

- Overlay unchanged structurally: `fixed inset-0 z-50 flex justify-end bg-ink/30`
- Panel: `h-full w-full max-w-xl overflow-y-auto border-l border-border bg-surface p-6 shadow-card`
- Title: `text-xl font-semibold text-ink` (no serif)
- Close: `ui-btn-secondary`
- Loading: `text-ink-muted`
- Markdown block: `rounded-control border border-border bg-paper p-4`
- Issue cards: `rounded-control border border-border p-3`
- Description: `text-ink-muted`
- Rule title: `font-mono text-xs text-brand`

Do not change fetch URL or markdown rendering plugins.

- [ ] **Step 4: Verify**

Open `/review-logs`, click a row: drawer opens; verdict uses mono + color; close still works; table scrolls on narrow widths.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/\(main\)/review-logs/page.tsx apps/web/components/reviews/review-logs-client.tsx apps/web/components/reviews/review-detail-drawer.tsx
git commit -m "$(cat <<'EOF'
style(web): restyle review logs and detail drawer

EOF
)"
```

---

### Task 7: Acceptance sweep

**Files:**
- Test only (no product code unless grep finds leftovers)

**Interfaces:**
- Consumes: all prior tasks
- Produces: green acceptance checklist matching the spec

- [ ] **Step 1: Grep leftovers**

```bash
cd /Users/Admin/Project/code-guard
rg -n "Source Serif|bg-white/80|ring-1 ring-slate-200" apps/web
rg -n "font-display" apps/web
```

Expected:

- No `Source Serif`
- No `bg-white/80` / old slate ring card pattern
- `font-display` may remain only if still mapped to IBM Plex Sans; prefer replacing titles with `ui-page-title` so `font-display` usage is minimal/none

If leftovers remain on pages in scope, fix them in-place (same commit as Step 3).

- [ ] **Step 2: Build**

```bash
pnpm --filter @code-guard/web build
```

Expected: success.

- [ ] **Step 3: Manual acceptance checklist**

- [ ] Login, dashboard, projects, knowledge-base, review-logs all light Teal Swiss
- [ ] Focus rings visible on inputs/buttons
- [ ] Verdict text labels present with colors
- [ ] Forms still submit; drawer still opens
- [ ] ~375px: tables horizontally scroll, layout usable
- [ ] No dark mode introduced

- [ ] **Step 4: Final commit only if cleanup edits were needed**

```bash
git add apps/web
git commit -m "$(cat <<'EOF'
style(web): finish Teal Swiss visual acceptance cleanup

EOF
)"
```

If no cleanup, skip commit.

---

## Spec coverage self-check

| Spec requirement | Task |
| --- | --- |
| Tokens (colors/radius/shadow/fonts) | Task 1 |
| Flat paper, reduced-motion, focus ring utilities | Task 1 |
| Remove Source Serif | Task 1 + 7 |
| Shell + active nav | Task 2 |
| Login surface | Task 3 |
| Dashboard KPI mono + cards + chips | Task 4 |
| Chart token colors | Task 4 |
| Projects / knowledge surfaces | Task 5 |
| Review logs + drawer | Task 6 |
| Acceptance criteria | Task 7 |
| Non-goals (no dark mode, no API/IA changes) | Enforced in Global Constraints + each task “logic unchanged” |

## Placeholder / consistency notes

- Shared class names are stable: `ui-surface`, `ui-input`, `ui-btn-primary`, `ui-btn-secondary`, `ui-page-title`, `ui-page-subtitle`, `ui-error`, `ui-table-wrap`, `ui-nav-link`, `ui-nav-link-active`
- Chart hex values match spec tokens exactly (`#0F766E`, `#15803D`, `#B45309`, `#B91C1C`, `#E2E8F0`, `#64748B`)
)
