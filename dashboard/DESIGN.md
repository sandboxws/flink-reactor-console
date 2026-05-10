# FlinkReactor Hub — Design System

## Overview

FlinkReactor Hub is the dark-first, warm-palette redesign of the FlinkReactor console. The base atmosphere is a **near-black warm canvas** (`{colors.fr-bg}` — #101213) carrying **dune-cream foreground type** (`{colors.fg}` — #d4be98) — distinctly warm, deliberately not the cool slate-on-black that every other observability tool uses. Display sizes run **Geist Sans** at 500–600 weight; numerical data runs **Geist Mono** — IDs, timestamps, KPIs, log lines, kbd shortcuts. There is no serif display face. The combination feels like a Linear-class developer tool, not a SaaS chart deck.

Brand voltage comes from the **Gruvpuccin palette** — a hand-curated blend of Gruvbox warmth (coral, amber, sage, dune) with Catppuccin pastel accents (teal, rose, violet). The signature accent is **coral** (`{colors.fr-coral}` — #e78a4e), used scarcely on individual primary CTAs and generously on hover-glow rings, selected-row tints, and active-state pills. The coral is warm and slightly muted, never cyan/blue — a deliberate counter-positioning against the cool teals and electric blues that dominate the data-platform category.

The system has a **four-layer surface stack** (darkest → lightest):

1. **Page floor** (`{colors.fr-bg}`) — the body canvas
2. **Surface** (`{colors.dash-surface}`) — base panels and section bands
3. **Panel** (`{colors.dash-panel}`) — floating surfaces (Select, HoverCard, Popover)
4. **Elevated** (`{colors.dash-elevated}`) — hover and selected states only

Floating surfaces ALWAYS use `bg-dash-panel`. The dominant card treatment is the **glass-card** — a backdrop-blur(12px) translucent surface with a faint dune-tinted border that lights up to coral on hover. Where most dashboards use heavy drop-shadows for depth, Hub uses backdrop-filter and warm-tinted overlays.

This document is the canonical reference for the Hub design language. The visual contract is the **29 hand-written HTML mockup pages** in `console-v2/`. The React port — under `dashboard/src/routes/hub/*` and `packages/ui/` — mirrors them. When the mockup and the React port disagree, the mockup wins.

**Key Characteristics:**

- Dark-first, warm canvas. `{colors.fr-bg}` (#101213) is the page floor — Hub v1 is dark-only by route rule. Light + Tokyo Night palettes exist as tokens but ship as later changes.
- Coral primary accent (`{colors.fr-coral}` — #e78a4e). Used scarcely on individual CTAs (`{component.btn-primary}`) and in 4–10% alpha tints on hover, selected, and active states.
- Geist Sans + Geist Mono ONLY. No serif display face. Mono is mandatory for data: IDs, timestamps, KPI numerical values, log lines, code, kbd shortcuts, sidebar nav-counts.
- Four-layer surface stack with strict rules: `{colors.fr-bg}` → `{colors.dash-surface}` → `{colors.dash-panel}` → `{colors.dash-elevated}`. Floating surfaces always panel.
- The signature `{component.glass-card}` — backdrop-blur(12px), 3% dune-tint background, 6% dune-tint border, coral hover-glow.
- **No colored left-border accents on cards, rows, list items, or diff rows.** Status conveyed via pills, dots, background tints, or filled icons. The `{component.diff-line}` is the canonical example (added → 10% sage-tinted background, NOT a green left border).
- Linear-class component density: small font sizes (10–12.5px), tight padding (8–14px), monospace for everything numeric.
- Section heading style is non-negotiable: `{typography.section-heading}` (Geist Mono, 10px, 500 weight, uppercase, 0.1em letter-spacing, `{colors.fg-dim}`).
- Border radius hierarchy: `{rounded.sm}` 6px (nav-item, prop-chip, btn-sm) · `{rounded.md}` 8px (button, kanban-card, log-viewer, form-input) · `{rounded.lg}` 12px (kpi-card, kanban-col, glass-card) · `{rounded.pill}` 999px (status-pill, label-chip, avatar, live-dot).
- Backpressure is conveyed via **full-card outline rings** on operator nodes — never a left border.

## Colors

### Token map

The Hub uses CSS custom properties exposed through Tailwind v4's `@theme` directive. Every `{colors.*}` reference in this document maps to a CSS variable and a Tailwind utility class.

| Placeholder | CSS variable | Tailwind class (bg / text / border) |
|---|---|---|
| `{colors.fr-bg}` | `--color-fr-bg` | `bg-fr-bg`, `text-fr-bg`, `border-fr-bg` |
| `{colors.fr-coral}` | `--color-fr-coral` | `bg-fr-coral`, `text-fr-coral`, `border-fr-coral` |
| `{colors.fr-amber}` | `--color-fr-amber` | `bg-fr-amber`, `text-fr-amber`, `border-fr-amber` |
| `{colors.fr-sage}` | `--color-fr-sage` | `bg-fr-sage`, `text-fr-sage`, `border-fr-sage` |
| `{colors.fr-teal}` | `--color-fr-teal` | `bg-fr-teal`, `text-fr-teal`, `border-fr-teal` |
| `{colors.fr-rose}` | `--color-fr-rose` | `bg-fr-rose`, `text-fr-rose`, `border-fr-rose` |
| `{colors.fr-violet}` | `--color-fr-violet` | `bg-fr-violet`, `text-fr-violet`, `border-fr-violet` |
| `{colors.fr-coral-glow}` | `--color-fr-coral-glow` | (box-shadow / outline only) |
| `{colors.dash-surface}` | `--color-dash-surface` | `bg-dash-surface`, `border-dash-surface` |
| `{colors.dash-panel}` | `--color-dash-panel` | `bg-dash-panel`, `border-dash-panel` |
| `{colors.dash-elevated}` | `--color-dash-elevated` | `bg-dash-elevated`, `border-dash-elevated` |
| `{colors.dash-border}` | `--color-dash-border` | `border-dash-border` |
| `{colors.fg}` | `--color-fg` | `text-fg` |
| `{colors.fg-secondary}` | `--color-fg-secondary` | `text-fg-secondary` |
| `{colors.fg-muted}` | `--color-fg-muted` | `text-fg-muted` |
| `{colors.fg-dim}` | `--color-fg-dim` | `text-fg-dim` |
| `{colors.fg-faint}` | `--color-fg-faint` | `text-fg-faint` |
| `{colors.job-running}` | `--color-job-running` | `bg-job-running`, `text-job-running` |
| `{colors.log-error}` | `--color-log-error` | `bg-log-error`, `text-log-error` |
| `{colors.hm-3}` | `--color-hm-3` | `bg-hm-3` |

### Brand & Accent

The Gruvpuccin accent palette is six warm hues plus violet. Each has a strict semantic assignment — don't paint a coral icon to mean "warning" or a sage badge to mean "error."

| Token | Hex | Use |
|---|---|---|
| `{colors.fr-coral}` | #e78a4e | Primary CTA, selected state, active filter, hover-glow, file-tree active row |
| `{colors.fr-amber}` | #d8a657 | Warning, secondary CTA accent, kanban "stage" env, partial state (acknowledged) |
| `{colors.fr-sage}` | #a9b665 | Success, healthy state, running job, live indicator, "OK" severity |
| `{colors.fr-teal}` | #7daea3 | Info, finished job, debug log, "info" severity, dev env |
| `{colors.fr-rose}` | #ea6962 | Error, failed job, critical alert, error log, prod env |
| `{colors.fr-violet}` | #bb9af7 | Operator-kind badge ("op" vertex). Reserved — do not use for status |
| `{colors.fr-bg}` | #101213 | Page floor. Also used as text color on coral-fill buttons (`{component.btn-primary}`) — text "punches out" of the fill |
| `{colors.fr-subtle}` | #141617 | Subtle fill — alias for `{colors.dash-surface}` |

Note: `{colors.fr-purple}` (#a9b665) is a deprecated alias for `{colors.fr-sage}`. Kept "for one release" per the comment in `tokens.css:17`. Don't reach for it; flag in code review.

### Glow tints

Glow tints are RGBA color values used in `box-shadow` and `outline` only — never as a `background-color` or `border-color`. They render the warm-light "lit-from-within" feeling that distinguishes a Hub component in active or live state.

| Token | Value | Use |
|---|---|---|
| `{colors.fr-coral-glow}` | rgba(231, 138, 78, 0.6) | Status-icon firing, hover ring on glass-card, selected operator node |
| `{colors.fr-sage-glow}` | rgba(169, 182, 101, 0.7) | Live-dot (default sage), engine-callout |
| `{colors.fr-amber-glow}` | rgba(216, 166, 87, 0.6) | Live-dot (amber variant) |
| `{colors.fr-teal-glow}` | rgba(125, 174, 163, 0.5) | Live-dot (teal variant) |
| `{colors.fr-rose-glow}` | rgba(234, 105, 98, 0.5) | Live-dot (rose variant), priority-urgent bars |

### Surface stack

Four layers, darkest to lightest. Hub's depth comes from this stack — not from drop shadows.

| Token | Hex | Use |
|---|---|---|
| `{colors.fr-bg}` | #101213 | Page floor (`<HubShell>` background, `.page-shell`) |
| `{colors.dash-surface}` | #141617 | Section bands, base panels, sub-nav rows |
| `{colors.dash-panel}` | #181a1b | Floating surfaces — SelectContent, HoverCardContent, PopoverContent, DropdownMenuContent |
| `{colors.dash-elevated}` | #242424 | Hover states, selected rows, elevated cards inside dark bands |
| `{colors.dash-border}` | #2e2c2b | The 1px hairline. The default border tone on every card, row, table |
| `{colors.dash-hover}` | #242424 | Same hex as `dash-elevated`. Used on `.data-row:hover`, `.log-line:hover` |

**Hard rule:** floating surfaces (Select, HoverCard, Popover, DropdownMenu) ALWAYS use `bg-dash-panel border-dash-border`. Never `bg-dash-elevated` for floats — `dash-elevated` is reserved for hover/selected states inside an existing surface.

### Foreground hierarchy

Five steps. The hierarchy is dune (warm tan) rather than gray — the same warmth that runs through the canvas.

| Token | Hex | Use |
|---|---|---|
| `{colors.fg}` | #d4be98 | Primary text. Headlines, KPI values, table cell content, primary nav labels |
| `{colors.fg-secondary}` | #bfb3a2 | Emphasized body, lead paragraphs |
| `{colors.fg-muted}` | #a69a8a | Default body, sub-headings, breadcrumbs, sidebar inactive labels |
| `{colors.fg-dim}` | #7c7269 | Captions, timestamps, secondary metadata, KPI labels, section headings |
| `{colors.fg-faint}` | #5a524c | Line numbers, placeholders, fine-print, disabled state |

### Job status

Five Flink job states. Each has an exact hex per palette.

| Token | Gruvpuccin Dark | Use |
|---|---|---|
| `{colors.job-running}` | #a9b665 (sage) | Running. Pairs with `{component.live-dot}` |
| `{colors.job-finished}` | #7daea3 (teal) | Completed |
| `{colors.job-cancelled}` | #d8a657 (amber) | Cancelled or canceling |
| `{colors.job-failed}` | #ea6962 (rose) | Failed |
| `{colors.job-created}` | #5a524c (faint) | Created, initializing, pending |

These render as `.status-pill`, `.state-pill`, `.fr-op-node .pill`, and `.tk-status` classes — see `{component.status-pill}`.

`{colors.status-active}` (#a9b665) is a separate semantic alias for sage, used outside job context (active deployments, healthy connections). Same hex as `{colors.job-running}` — they intentionally render identically.

### Log severity

| Token | Gruvpuccin Dark |
|---|---|
| `{colors.log-trace}` | #5a524c |
| `{colors.log-debug}` | #7daea3 |
| `{colors.log-info}` | #89b482 |
| `{colors.log-warn}` | #d8a657 |
| `{colors.log-error}` | #ea6962 |

Log severity colors map onto the `.log-viewer .log-level.{trace,debug,info,warn,error}` and `.severity-badge` / `.sev-badge` classes.

### Heatmap intensity

Five-step transparency-modulated scale, sage-low to coral-high. Used in checkpoint heatmaps, simulation grids, calendar densities.

| Token | Value |
|---|---|
| `{colors.hm-0}` | rgba(212, 190, 152, 0.04) |
| `{colors.hm-1}` | rgba(125, 174, 163, 0.35) |
| `{colors.hm-2}` | rgba(169, 182, 101, 0.55) |
| `{colors.hm-3}` | rgba(216, 166, 87, 0.75) |
| `{colors.hm-4}` | rgba(231, 138, 78, 0.95) |

### Chart cursor overlays

| Token | Value |
|---|---|
| `{colors.chart-cursor}` | rgba(212, 190, 152, 0.08) |
| `{colors.chart-cursor-fill}` | rgba(212, 190, 152, 0.04) |

### Theme matrix

Four palettes are defined in `tokens.css` and `global.css`. Hub v1 ships dark-only — see "Known Gaps."

| Palette | Selector | Status in Hub v1 |
|---|---|---|
| Gruvpuccin Dark (default) | `<html>` | **Canonical.** All components render against this palette |
| Gruvpuccin Light | `<html class="light">` | Tokens defined, not yet wired in Hub routes (`fr-console-hub-light-theme`) |
| Tokyo Night Dark | `<html data-palette="tokyo-night">` | Tokens defined, not yet wired in Hub routes (`fr-console-hub-tokyo-night`) |
| Tokyo Night Light | `<html class="light" data-palette="tokyo-night">` | Tokens defined, not yet wired in Hub routes |

### Dual-token mirroring rule

Any new Hub token MUST land in BOTH:
1. `packages/ui/src/styles/tokens.css` — for external consumers of `@flink-reactor/ui`
2. `dashboard/src/global.css` `@theme` block — the dashboard does not consume `tokens.css` via CSS import; it uses Tailwind v4's `@theme` directive to generate utilities

Skipping the mirror produces a silent failure: `var(--color-foo)` resolves at runtime but `bg-foo`/`text-foo` Tailwind utilities don't exist, and the linter won't catch it.

## Typography

### Font Family

The system runs **Geist** (variable, 100–900) for sans and **Geist Mono** (variable, 100–900) for monospace. Both are self-hosted from `/fonts/GeistVF.woff2` and `/fonts/GeistMonoVF.woff2` with `font-display: swap`. The fallback stack walks `Geist, ui-sans-serif, system-ui, sans-serif` for sans and `Geist Mono, ui-monospace, SFMono-Regular, monospace` for mono.

There is no serif display face. The brand voice is a humanist sans for prose and a precision mono for data — the split is inviolable.

**CSS variables:**
- `var(--font-sans)` — Geist
- `var(--font-mono)` — Geist Mono

**Hard rule:** Use `var(--font-mono)`. Do NOT use `var(--font-geist-mono)` — that variable does not exist and silently falls back to the browser default. This is one of the most common Hub regressions.

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Family | Use |
|---|---|---|---|---|---|---|
| `{typography.page-title}` | 28px | 600 | 1.2 | -0.01em | Geist | Hub page h1 ("Overview", "Jobs", "Errors") |
| `{typography.detail-title}` | 24px | 600 | 1.2 | -0.01em | Geist | Detail-page h1 (job-detail, TM-detail) |
| `{typography.section}` | 16px | 500 | 1.4 | 0 | Geist | Section headings inside cards |
| `{typography.subsection}` | 14px | 500 | 1.4 | 0 | Geist | Sub-section headings, intro paragraphs |
| `{typography.body}` | 13–14px | 400 | 1.55 | 0 | Geist | Default running-text, modal copy |
| `{typography.row}` | 12.5px | 400 | 1.4 | 0 | Geist | Table rows, nav items, tabs, log rows |
| `{typography.kpi-value}` | 22px | 400 | 1.1 | 0 | Geist Mono | KPI numerical values |
| `{typography.kpi-label}` | 10px | 500 | 1.4 | 0.08em | Geist Mono | KPI labels (uppercase) |
| `{typography.section-heading}` | 10px | 500 | 1.4 | 0.1em | Geist Mono | Sidebar group labels, card section titles (uppercase) |
| `{typography.log-row}` | 12px | 400 | 1.6 | 0 | Geist Mono | Log lines in `.log-viewer` |
| `{typography.code}` | 12.5px | 400 | 1.7 | 0 | Geist Mono | `.code-viewer` content |
| `{typography.metric-label}` | 8.5px | 400 | 1.2 | 0.06em | Geist Mono | Operator-node metric labels (uppercase) |
| `{typography.op-pill}` | 9.5px | 600 | 1.0 | 0.04em | Geist Mono | Operator-node status pill (uppercase) |
| `{typography.button}` | 12.5px | 500 | 1.0 | 0 | Geist | `.btn` family |
| `{typography.button-sm}` | 11.5px | 500 | 1.0 | 0 | Geist | `.btn-sm` |
| `{typography.caption}` | 10.5px | 500 | 1.4 | 0 | Geist | `.label-chip`, `.activity-time` (mono variant), card metadata |
| `{typography.caption-uppercase}` | 10px | 600 | 1.0 | 0.04em | Geist Mono | `.severity-badge`, `.sev-badge`, `.log-level` |

### Mono mandate

Monospace is not optional — it is the convention that telegraphs "this is data, not prose." Use `var(--font-mono)` for:

- All cluster IDs, job IDs, vertex IDs, deployment IDs, file paths
- All timestamps (`HH:MM:SS.mmm`, ISO datetimes, durations, "5m ago")
- All numerical KPI values (record/sec, MB/s, latency ms, slot counts)
- All log lines, stack traces, code blocks
- Sidebar `.nav-count` (the right-aligned counter on a nav item)
- Kbd shortcuts (`Cmd+K`, `↵`, `Esc`)
- Operator-node metric values, sparkbar tooltips, heatmap-cell data labels

Sans-serif (Geist) handles everything else: page titles, section headings, button labels, body copy, navigation labels.

### Principles

- Display sizes use weight 600 maximum. Headlines never go bolder.
- Negative letter-spacing applies only at 22px+ and only at -0.01em — Geist's humanist proportions don't need aggressive tracking.
- Mono caption styles use UPPERCASE with letter-spacing 0.04–0.1em. The wider tracking creates a "small-caps editorial" feel for section headings, severity badges, and metric labels.
- All caption text in mono is 10–10.5px. The Hub's information density is its identity — going larger reads as marketing.

## Layout

### Spacing System

- **Base unit:** 4px.
- **Tokens:** `{spacing.xxs}` 4px · `{spacing.xs}` 8px · `{spacing.sm}` 12px · `{spacing.md}` 16px · `{spacing.lg}` 24px · `{spacing.xl}` 32px · `{spacing.xxl}` 48px · `{spacing.section}` 96px.
- **Card internal padding:** `{spacing.md}` (16px) for KPI cards, `{spacing.sm}` 12px for sidebar nav-items, `{spacing.md}` for kanban-card top/bottom.
- **Row padding:** `8px 12–18px` for issue-row, sev-row, log-row, pipe-row, tm-row.
- **Section padding:** `{spacing.lg}` (24px) between major bands. Hub is denser than a marketing page — section padding is half the marketing standard.

### Grid & Container

The Hub page-grid is the dominant layout primitive.

```css
.page-grid {
  display: grid;
  grid-template-columns: 240px 1fr;
  min-height: calc(100vh - 56px); /* 56px = h-14 top bar */
}
.page-grid.with-rail {
  grid-template-columns: 240px 1fr 300px;
}
```

- **Sidebar:** fixed 240px column at left
- **Main:** flexible 1fr column
- **Right rail (optional):** fixed 300px column at right
- **Top bar:** sticky 56px (h-14) above the grid
- **Page shell:** `min-height: 100vh; background: var(--color-fr-bg)`

The shell is composed by `<HubShell>`. Routes pass `topBar`, `sidebar`, `rail` (optional), and `children` props. Right-rail content is lazy — render a meaningful summary, never an empty column.

**Hard rule (HubShell):** the rail must never be empty. If the route can't produce a contextual summary (job summary card, instrument detail, recent activity), provide a fallback. The DAG-page whitespace bug came from violating this.

### LinkComponent contract

Layout components in `packages/ui/` are router-agnostic. They accept `LinkComponent` as a prop instead of importing TanStack Router directly. The dashboard passes its `Link` adapter at the route boundary:

```tsx
<HubShell
  topBar={<HubTopBar LinkComponent={RouterLink} ... />}
  sidebar={<HubSidebar LinkComponent={RouterLink} ... />}
  ...
/>
```

**Hard rule:** never hardcode `<a href>` in a Hub primitive — the click would trigger a full page reload. Always thread `LinkComponent` from the consumer.

### Whitespace philosophy

Hub is a high-information surface. Whitespace is tighter than a marketing page (24px between bands vs. 96px), tighter than a typical SaaS dashboard (16px card padding vs. 32px). The density is intentional — it's how a Linear-class developer tool feels.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | No shadow, no border | Body sections, `<HubTopBar>` at rest |
| Hairline | 1px `{colors.dash-border}` border | Inputs, sub-nav rows, table rows, side panels |
| Glass card | `backdrop-filter: blur(12px)` + 3% dune fill + 6% dune border | Default content card. See `{component.glass-card}` |
| Glass card hover | Border lifts to 25% coral, ambient `0 0 24px {colors.fr-coral-glow}/0.06` | Interactive variant |
| Floating surface | `bg-dash-panel` + `0 4px 12px rgba(0,0,0,0.4)` | Select, HoverCard, Popover, DropdownMenu, react-flow Controls/MiniMap |
| Status glow | `box-shadow: 0 0 8px {colors.fr-coral-glow}` | Status-icon firing, live-dot |
| Hover lift | `transform: translateY(-1px)` + coral border | `.kanban-card`, `.fr-op-node` |

### Glass card (verbatim CSS)

Two variants. The interactive one (`.glass-card`) lifts on hover; the static one (`.glass-card-static`) does not. Hub pages use `glass-card-static` for non-interactive content surfaces (e.g., `ActivityFeed` wraps its card in `glass-card-static p-5`) and reserves the hover variant for clickable cards.

```css
/* Base shape — packages/ui/src/styles/hub.css and dashboard/src/global.css */
.glass-card {
  border: 1px solid rgba(212, 190, 152, 0.06);
  border-radius: 0.75rem;
  backdrop-filter: blur(12px);
  transition: box-shadow 0.3s;
}

/* Gruvpuccin tint (default) — dashboard/src/global.css */
.glass-card {
  background: rgba(212, 190, 152, 0.03);
  border-color: rgba(212, 190, 152, 0.06);
}
.glass-card:hover {
  border-color: rgba(231, 138, 78, 0.25);
  box-shadow: 0 0 24px rgba(231, 138, 78, 0.06);
}

/* Static (non-interactive) variant — packages/ui/src/styles/hub.css */
.glass-card-static {
  background: rgba(212, 190, 152, 0.03);
  border: 1px solid rgba(212, 190, 152, 0.06);
  border-radius: 0.75rem;
  backdrop-filter: blur(12px);
}
```

### HubTopBar scroll-glass

The top bar is transparent at rest (just a thin bottom hairline). On scroll past threshold, it activates `backdrop-filter: blur(8px)` and tints to a semi-opaque `bg-fr-bg/80` with a subtle drop-shadow. The behavior is internal to `<HubTopBar>` — consumers don't manage it. Introduced in commit `84fdd4c`.

### Backpressure rings

Backpressure on operator nodes is conveyed via the FULL CARD outline ring — never a colored left border. Inactive nodes have `border: 1px solid {colors.dash-border}`. A warning state replaces the border with `1px solid rgba(216, 166, 87, 0.5)` plus an outer 1px amber halo. A critical state escalates to `rgba(234, 105, 98, 0.6)` border plus a 24px coral-rose ambient glow:

```css
.fr-op-node[data-bp="warn"]  { border-color: rgba(216, 166, 87, 0.5); ... }
.fr-op-node[data-bp="crit"]  { border-color: rgba(234, 105, 98, 0.6); ... }
```

This is the brand's strongest demo of the "ring/tint not border" rule.

### Decorative depth

- **Dot grid background** — `.dot-grid` paints a 24×24 grid of 1px dune dots at 4% alpha. Used as a subtle texture on the overview surface and primitive sandbox.
- **Heatmap fills** — `.hm-0` through `.hm-4` paint translucent fills that read as "more activity = warmer." The transparency modulation lets underlying surfaces show through.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.xs}` | 3–4px | `.severity-badge`, `.heatmap-cell`, `.sev-badge`, `.cluster-selector .env` |
| `{rounded.sm}` | 6px | `.nav-item`, `.prop-chip`, `.sev-row`, `.btn-sm`, `.file-tree-row` |
| `{rounded.md}` | 8px | `.btn` default, `.kanban-card`, `.log-viewer`, `.cluster-selector`, `.form-input`, `.add-card`, react-flow Controls/MiniMap |
| `{rounded.op-node}` | 10px | `.fr-op-node` operator card |
| `{rounded.lg}` | 12px | `.kanban-col`, `.kpi-card`, `.code-viewer`, `.glass-card`, `.glass-card-static` |
| `{rounded.pill}` | 999px | `.status-pill`, `.state-pill`, `.label-chip`, `.live-dot`, `.avatar`, `.cluster-selector .env` (separately), `.sparkbar` segments, status-icon `::before` |

### Border widths

- **1px** — default everywhere
- **1.5px** — `.status-icon` ring strokes, `.react-flow__handle` strokes (prevents zero-size clipping that would NaN the edge paths)
- **2px** — `.tab[data-state="active"]` underline, `.detail-tab[data-state="active"]::after`

### Iconography

Hub icons follow a strict contract:

```css
/* hub.css:11-25 — applied to Hub chrome icons only */
.nav-item svg,
.tab svg,
.btn svg,
.cluster-selector svg,
.activity-icon svg,
.add-card svg,
.kanban-card svg,
.kanban-col-header svg,
.file-tree-row svg,
.prop-chip svg,
.state-pill svg {
  width: 1em;
  height: 1em;
  stroke-width: 1.6;
}
```

Icons inherit `1em` sizing from their text container and use a thinner `1.6` stroke than Lucide's default `2`. The selector list is deliberately scoped — chart icons, brand glyphs, and react-flow node icons get their own stroke widths. All icons come from `lucide-react` (no other icon library).

## Components

The Hub component vocabulary. CSS class definitions live in `packages/ui/src/styles/hub.css`; typed React wrappers live in `packages/ui/src/components/ui/` and `packages/ui/src/layout/`. Where both exist, the **React wrapper is canonical**; the CSS class is documented for raw use cases.

### Layout shell

**`HubShell`** — The Hub page shell. Composes top-bar + sidebar + main + optional right rail in a `display: grid` container so `min-height: 100%` on the rail eliminates dead space below short main content. Exported from `@flink-reactor/ui`. Wraps every Hub route — never compose `Shell` (legacy) with Hub innards.

```tsx
<HubShell
  topBar={<HubTopBar ... />}
  sidebar={<HubSidebar ... />}
  rail={<JobSummaryCard ... />}  // optional, never empty
>
  {pageContent}
</HubShell>
```

**`HubTopBar`** — 56px (h-14) sticky top bar. Carries:
- Left: `<BrandGlyph>` (concentric coral rings) + `flinkreactor.hub` wordmark + `ALPHA` chip — always together
- Center: `<HubBreadcrumb>` (mono, slash-separated)
- Right: `<ClusterSelector>` pill + search button (`Cmd+K` / `Ctrl+K` opens `<HubCommandPalette>`)
- Scroll-glass behavior: transparent at rest, blur+tinted-bg activates on scroll

Props: `cluster?`, `clusterSlot?`, `onClusterClick?`, `onSearchOpen?`, `LinkComponent?`. Pass `clusterSlot` to wrap the cluster pill in a custom Popover.

**`HubSidebar`** — 240px sectioned navigation column. Sections render via `.section-heading` (mono, 10px, 500, uppercase, 0.1em tracking, `{colors.fg-dim}`). Active item gets `{colors.fr-coral}` text + 8% coral-tint background. Nav-counts at the right edge use `var(--font-mono)` 10px.

```tsx
<HubSidebar
  sections={HUB_SIDEBAR_SECTIONS}  // canonical config
  activePath={location.pathname}
  LinkComponent={RouterLink}
/>
```

**`HubCommandPalette`** — Rethemed cmdk dialog with grouped routes, hint kbd shortcuts, mono input, footer kbd hints. Toggle with `Cmd+K` / `Ctrl+K`. Props: `open`, `onClose`, `onNavigate`, `routes`.

**`HubBreadcrumb`** — Page-header breadcrumb. Crumbs `[{label, to?, mono?}]` with `/` separators. Last crumb is non-link. Pass `LinkComponent` for router-aware nav.

**`<ClusterSelector>` / `.cluster-selector`** — Top-bar cluster pill. 32px tall, mono 12px, `bg-rgba(20,22,23,0.6)` with `{colors.dash-border}`, rounded-md. The `.env` modifier paints the environment badge:
- `.env.prod` — `{colors.fr-rose}` (#ea6962) on 12% rose tint
- `.env.stage` — `{colors.fr-amber}` (#d8a657) on 12% amber tint
- `.env.dev` — `{colors.fr-teal}` (#7daea3) on 12% teal tint

### Surface containers

**`.glass-card`** / **`<MetricCard>`** — The signature interactive content card. Hover lifts the border to 25% coral and adds a 24px ambient coral glow. See "Elevation & Depth" for the verbatim CSS.

**`.glass-card-static`** — Non-interactive variant. Same shape, no hover. Hub pages use this for content surfaces that aren't clickable (activity feeds, KPI quads, summary panels).

### KPI

**`<KpiCard>` / `.kpi-card`** — The standard metric tile.

```css
.kpi-card {
  background: rgba(212, 190, 152, 0.03);
  border: 1px solid rgba(212, 190, 152, 0.06);
  border-radius: 12px;
  padding: 14px 16px;
  backdrop-filter: blur(12px);
  transition: border-color 0.2s;
}
.kpi-card:hover { border-color: rgba(231, 138, 78, 0.2); }
```

Anatomy:
- `.kpi-label` — `{typography.kpi-label}` (mono, 10px, uppercase, 0.08em tracking, `{colors.fg-dim}`)
- `.kpi-value` — `{typography.kpi-value}` (mono, 22px, `{colors.fg}`)
- `.kpi-sub` — `{typography.kpi-label}` (mono, 10px, `{colors.fg-dim}`)

The `<KpiCard>` React wrapper accepts `label`, `value`, `liveDot`, `sub`, and `children` (for inline charts like `.resource-bar`). Used in `OverviewKpiQuad` (a 2×2 grid) and detail-page right rails. When `value` is unavailable, render `—`, never `0`.

### Status indicators

Boundary rule: `<StatusPill>` conveys **entity state** (job, deployment, vertex). `<SevBadge>` conveys **severity classification** (alerts, instrument health). Don't mix them.

**`.status-pill`** — Pill-shaped state badge. Sage/teal/rose/amber/muted variants for `.running`, `.finished`, `.failed`, `.cancelled`/`.warning`, `.live`, `.pending`/`.draft`. Pairs with `<LiveDot>` when state is `running` or `live`.

```
.status-pill.running    → sage on 10% sage tint, 30% sage border
.status-pill.finished   → teal on 10% teal tint
.status-pill.failed     → rose on 10% rose tint
.status-pill.cancelled  → amber on 10% amber tint
.status-pill.warning    → amber (alias for cancelled visual)
.status-pill.live       → sage (alias for running)
.status-pill.pending    → muted on 10% dim tint
.status-pill.draft      → dim on 10% dim tint
```

**`.state-pill`** — Deployment state machine pill (mono variant). Variants `.done`, `.active`, `.pending`, `.failed`. Used on the deployments page where state machine semantics matter.

**`.sev-badge` / `<SevBadge>`** — Linear-style severity badge. Mono 10px, 600 weight, uppercase, 0.04em tracking. Variants `.ok`, `.warn`, `.fail`, `.info`, `.muted`, `.coral`. Each renders as a tinted background + 30% colored border + matching text color. Use for instrument health rows, alert classification.

**`<StatusIcon>` / `.status-icon`** — 14×14 conic-gradient ring icon for the 6 alert states:
- `.firing` — solid coral fill + 8px coral glow
- `.acknowledged` — 50% conic amber + 1.5px amber border
- `.in-progress` — 65% conic sage + 1.5px sage border
- `.resolved` — solid sage fill + checkmark glyph
- `.suppressed` — 1.5px dim border (no fill)
- `.silenced` — 1.5px faint border + diagonal slash

**`<LiveDot>` / `.live-dot`** — 7×7 pulsing dot. Default sage; variants `.coral`, `.amber`, `.rose`, `.teal`. Animates `live-pulse 1.6s ease-in-out infinite` (50% scale to 1.25, opacity to 0.55). Drops a `0 0 10px {colors.fr-{tone}-glow}` halo. Use to indicate live streaming, running pipelines, active connections.

### Filter / property chips

**`.prop-chip` / `<PropChip>`** — Toggleable filter chip. Inactive: dune-tinted 6% border, `{colors.fg-muted}` text. Active: 40% coral border, `{colors.fr-coral}` text, 6% coral background. Optional `.count` child uses mono 10px `{colors.fg-dim}`.

**`.label-chip`** — Static label badge with leading dot. The dot is a `::before` pseudo-element using `currentColor`, 6×6 round. 10.5px text, 999px radius.

### Tables / rows

**`.pipe-row`** — Pipeline (job) table row.
```
grid-template-columns: 18px 1fr 90px 100px 80px 100px 50px 32px;
padding: 12px 18px;
font-size: 12.5px;
hover: bg rgba(231, 138, 78, 0.04);
border-bottom: 1px solid {colors.dash-border};
```

**`.tm-row`** — Task-manager table row. Same shape with grid `18px 140px 1fr 90px 90px 100px 80px 32px`.

**`.issue-row`** — Errors/alerts row. Grid `16px 14px 80px 1fr auto auto auto`. ID column uses mono 11px `{colors.fg-dim}`. Title column hovers to `{colors.fr-coral}`.

**`.activity-entry`** — Activity timeline row. Grid `24px 1fr auto`. `.activity-time` uses mono 10.5px `{colors.fg-faint}`. Strong text inside `.activity-text` lifts to `{colors.fg}` weight 500.

**`.sev-row`** — Instrument health list row. Grid `14px 1fr 60px 80px`.

**`.file-tree-row`** — Catalog tree row. 6px radius, 4px padding. Active state uses 10% coral background + `{colors.fg}`.

Common pattern: `border-bottom: 1px solid {colors.dash-border}`, hover `bg rgba(231, 138, 78, 0.04)` (4% coral tint), `:last-child { border-bottom: 0 }`. NO left-border accents — selection and severity are conveyed by background tint only.

### Resource visualizations

**`.resource-bar`** — Horizontal stacked bar for memory or slot utilization. Segments `.heap` (sage), `.managed` (amber), `.network` (teal), `.direct` (coral), `.free` (5% dune tint). 8px tall, 4px radius.

**`.priority`** — Linear-style 3-bar priority indicator. Variants `.priority-{none,low,medium,high,urgent}`. Urgent gets a rose glow.

**`.sparkbar`** — Simulation/test outcome sparkline. 28px tall flexbox. Span variants `.pass` (sage), `.fail` (rose), `.run` (amber), `.skip` (faint), `.info` (teal).

**`.health-ring`** — Cluster health conic-gradient ring. 80×80, sage `.ring-fg` stroke, dim `.ring-bg`, mono 16px label centered.

**`<HeatmapCell>` / `.hm-0` … `.hm-4`** — Heatmap intensity cells. 5 levels, transparency-modulated. Used in checkpoint heatmap, simulation grids.

**`<HeatmapCalendar>`** — Calendar-grid heatmap. Composes `HeatmapCell` over a 7-row × N-column grid.

### Code & logs

**`.log-viewer`** — Hub log container. Mono 12px, 1.6 line-height. 8px radius, 1px hairline, near-black `rgba(10, 11, 12, 0.85)` background.

```css
.log-viewer .log-row {
  display: grid;
  grid-template-columns: 50px 90px 60px 1fr;  /* num | time | level | msg */
  padding: 0 16px;
  white-space: pre;
  align-items: baseline;
}
```

`.log-num` — line number, faint, right-aligned, user-select: none.
`.log-time` — timestamp, dim, mono, user-select: none.
`.log-level` — uppercase 10px 600 with 0.04em tracking. Variants `.trace` (faint), `.debug` (dim), `.info` (teal), `.warn` (amber), `.error` (rose).
`.log-msg` — message body. Variant tints mirror level (warn → amber, error → rose, success → sage).

**`.code-viewer`** — Code/JSON display. Two-column grid: line numbers + content. 12.5px mono, 1.7 line-height. Faux syntax tinting via `.tk-*` spans:

| Class | Color | Use |
|---|---|---|
| `.tk-key` | amber | Object keys, attribute names |
| `.tk-str` | sage | String literals |
| `.tk-num` | coral | Numbers |
| `.tk-com` | faint, italic | Comments |
| `.tk-typ` | teal | Type names |
| `.tk-fn` | fg, weight 500 | Function names |
| `.tk-pun` | muted | Punctuation, brackets |
| `.tk-op` | rose | Operators |
| `.tk-attr` | violet | XML/JSX attributes |

The viewer is a "faux syntax" highlighter — tokens are painted by hand in the markup, not by a real tokenizer. Good enough for static mockups and short snippets; use a real tokenizer for editable code.

### Diff

**`<DiffViewer>` / `<DiffLine>` / `.diff-line`** — Diff display. **The canonical "background-tint, never left-border" demo.**

```css
.diff-line.added   { background: rgba(169, 182, 101, 0.10); }   /* sage tint */
.diff-line.added .gutter   { color: {colors.fr-sage}; background: rgba(169, 182, 101, 0.15); }

.diff-line.removed { background: rgba(231, 138, 78, 0.10); }    /* coral tint */
.diff-line.removed .gutter { color: {colors.fr-coral}; background: rgba(231, 138, 78, 0.15); }

.diff-line.hunk    { background: rgba(125, 174, 163, 0.06); color: {colors.fr-teal}; }
```

Grid: `50px 50px 14px 1fr` (line-num-old | line-num-new | gutter | code). Mono 12.5px, line-height 1.6. The gutter shows `+` or `-` colored to match the row tint. **No left border** — the entire row background is tinted.

### Kanban

**`.kanban-col`** — Deployment board column. 280px wide, 12px radius, 2.5% dune background. Column header has a bottom hairline. Body scrolls.

**`.kanban-card`** — Drag-and-drop card. 8px radius, 1px hairline, `rgba(20, 22, 23, 0.7)` background, padding 10×12px. Hover: 30% coral border + `translateY(-1px)`. Card-id mono 10px dim. Card-title 13px `{colors.fg}`. Done variant: `opacity: 0.7`.

**`.add-card`** — Dashed-border "add new" button. 8px radius, dashed border, 11px text. Hover: coral border + 4% coral background.

### DAG (operator nodes)

**`.fr-op-node`** — Operator card. **320px wide, NO fixed height** (let content dictate it). 10px radius, `rgba(20, 22, 23, 0.92)` background, 1px hairline. The fixed-height + flex-layout combination interacts with xyflow's ResizeObserver in a way that leaves source-side handleBounds unpopulated and produces NaN edge paths — don't reintroduce them without verifying edge connectivity.

Anatomy:
- `.head` — grid `18px 1fr auto`. Icon (kind-tinted) + name + status pill. 9×12px padding, dune-tinted background, hairline bottom.
- `.metrics` — grid `repeat(4, 1fr)`. 4 columns × 2 rows of label+value pairs. 9×12px padding, 6×10px gaps.
- `.task-bar` — proportional stacked bar at bottom showing task state distribution (created/running/finished/canceling/failed). 6px tall, 3px radius.

Header icon kind tints (use `kind-*` class names — bare `.source`/`.sink` would collide with xyflow's handle querySelector):
- `.icon.kind-source` — coral
- `.icon.kind-op` — violet
- `.icon.kind-sink` — amber
- `.icon.kind-shuffle` — teal

Status pill tints mirror `.status-pill` (sage/teal/rose/amber). The pill replaces what would otherwise be a colored left border.

Backpressure: `[data-bp="warn"]` and `[data-bp="crit"]` paint full-card outline rings — see "Elevation & Depth."

Selection: `.selected` and `.react-flow__node.selected .fr-op-node` paint a 60% coral border + outer 1px coral ring + 14px coral ambient glow.

**Edges** — `.react-flow__edge-path` strokes 1.5 dim by default, 2.0 coral when selected, animated `dash-flow 1.2s` when "hot." `!important` is required because xyflow's CSS lands unlayered and beats any named layer.

**Handles** — visually muted `8×8`, dim border. NEVER override `top`/`left`/`transform` on handles — interferes with xyflow's `getBoundingClientRect` measurement.

**Controls / MiniMap** — `bg-rgba(20, 22, 23, 0.92)`, 1px hairline, 8px radius, `box-shadow: 0 4px 12px rgba(0,0,0,0.4)`, `backdrop-filter: blur(8px)`. The standard floating-surface treatment.

### Buttons

Hub has two button systems:

1. **Raw `.btn` family** — for Hub layout chrome (top-bar, sidebar, sub-nav, kanban "add"). Direct `<button class="btn btn-primary">` markup preserves the static-mockup look one-to-one.
2. **`<Button>` Radix wrapper** — for typed forms inside Hub pages. Variants `default | secondary | destructive | outline | ghost | link`, sizes `default | sm | lg | icon`.

Boundary: use `.btn` when porting a mockup verbatim; use `<Button>` when composing inside a form, modal, or stateful surface.

**`.btn`** — 8px radius, padding 8×14px, font 12.5px Geist 500.
- `.btn-primary` — `{colors.fr-coral}` background, `{colors.fr-bg}` text (text "punches out" of the coral fill). Hover `#f29862` (lightened coral).
- `.btn-secondary` — 4% dune background, hairline border, `{colors.fg}` text. Hover: coral border + coral text.
- `.btn-ghost` — transparent. Hover: 4% white background, `{colors.fg}` text.
- `.btn-danger` — 10% rose background, 30% rose border, rose text. Hover: 20% rose background.
- `.btn-sm` — padding 5×10px, font 11.5px, radius 6px.
- `.btn-icon` — padding 6px, square.

### Forms

**`.form-input`** — Hub raw input. 36px tall, 8px radius, 1px hairline, font 13px Geist. Focus: 40% coral border + 1px coral box-shadow ring + opaque background. `.mono` modifier switches to mono 12px.

**`.form-textarea`** — `.form-input` + `min-height: 96px; padding: 10px 12px; resize: vertical`.

**`.form-label`** — 12px 500 above the input.

**`.form-help`** — 11px `{colors.fg-dim}` below the input.

Typed Radix wrappers exist for stateful forms: `<Input>`, `<Textarea>`, `<Field>` (Field, FieldLabel, FieldContent, FieldDescription, FieldError, FieldSet), `<Combobox>`, `<Select>`, `<InputGroup>` (Input + leading/trailing addons).

### Brand

**`<BrandGlyph>`** — Concentric coral rings logo. NOT a Lucide icon — custom SVG asset. Always paired with the `flinkreactor.hub` wordmark and `ALPHA` chip in the top bar. Never invert the glyph to white-on-dark within the lockup itself.

### Avatars

**`.avatar`** — Round mono-initial avatar. 8 gradient variants:
- `.avatar-coral` — coral → amber (135°)
- `.avatar-sage` — sage → teal
- `.avatar-amber` — amber → coral
- `.avatar-teal` — teal → sage
- `.avatar-rose` — rose → coral
- `.avatar-violet` — violet → rose
- `.avatar-deep` — teal → dark olive
- `.avatar-mixed` — amber → teal

Text color is `{colors.fr-bg}` (the page floor) — initials punch through the gradient fill.

### Sub-navigation

**`.tab`** — Underlined sub-nav tab. 12.5px Geist 500, 10×14px padding, 2px transparent bottom border. Active state (`.active` or `[data-state="active"]`): coral text + coral underline. `.tab-count` child uses mono 10px in a 999px-radius tinted pill.

### Tabs vs detail-tabs

There are two tab patterns in the codebase:

1. **`.tab`** (Hub) — coral underline, 12.5px Geist
2. **`.detail-tab`** (legacy compat) — purple underline (uses `{colors.fr-purple}` which aliases to sage), 11px font

For new Hub work, use `.tab`. `.detail-tab` exists for legacy compatibility and should not be used in fresh components.

### Engine callout

**`.engine-callout`** — Small absolute-positioned tooltip with a sage indicator dot at the bottom edge. Used on engine-bars (overview page) when hovering specific timepoints. 10px mono, 6px radius, dark backdrop, 4×8px padding, 4px×12px shadow.

## Do's and Don'ts

### Do

- Anchor every page on `{colors.fr-bg}` (#101213). The warm dark is the brand differentiator vs cool-slate competitors.
- Use Geist Sans for prose, Geist Mono for data. The split is inviolable.
- Use `var(--font-mono)` — NOT `var(--font-geist-mono)`. The latter does not exist and silently falls back.
- Use the four-layer surface stack consistently: page=`fr-bg`, panels=`dash-surface`, floats=`dash-panel`, hover/selected=`dash-elevated`.
- Convey status via pills (`{component.status-pill}`), dots (`{component.live-dot}`), filled icons (`{component.status-icon}`), or background tints (`{component.diff-line}`).
- Mirror new tokens into BOTH `packages/ui/src/styles/tokens.css` AND `dashboard/src/global.css` `@theme` block.
- Use static Tailwind class names. Object lookups for variant-by-prop styling: `const TONE = { sage: "text-fr-sage", coral: "text-fr-coral" }; <span className={TONE[tone]}>`.
- `@import "@flink-reactor/ui/styles/hub" layer(components);` — `layer(components)` is required.
- Route nav through `LinkComponent` props on `<HubSidebar>`, `<HubTopBar>`, `<HubBreadcrumb>`. Never hardcode `<a href>`.
- Place layout components in `packages/ui/src/layout/`, not `components/layout/`.
- Render a meaningful right rail (job summary, instrument detail, recent activity) — never an empty column.
- Match the mockup pixel-for-pixel when porting. Open `console-v2/<page>.html` end-to-end before writing TSX.
- Design for 1440px+. Below tablet is out of scope.
- Paint backpressure as a full-card outline ring on operator nodes. Never a left border.

### Don't

- Don't use cool slate, gray, or pure white for canvas. The warm dark is non-negotiable.
- Don't introduce a serif display face. Geist + Geist Mono only.
- Don't paint a colored left-border accent on cards, rows, list items, or diffs. The `.diff-line` styles are the canonical demonstration that status lives in the row background, not a left bar.
- Don't use `bg-dash-elevated` for floating surfaces (Select, HoverCard, Popover). Always `bg-dash-panel`.
- Don't template Tailwind class names like `text-${tone}` — Tailwind v4's static scanner can't see them. Use object lookups.
- Don't bold display weight beyond 600. Geist at 700 reads as bombastic.
- Don't reach for `{colors.fr-purple}`. It's a deprecated alias for `{colors.fr-sage}`.
- Don't introduce a 7th brand color. The Gruvpuccin palette is closed.
- Don't add hover styling beyond what the system encodes — primary darkens; glass-card lifts to coral; nothing else changes.
- Don't override `top`/`left`/`transform` on `.react-flow__handle` — even with the same values, it interferes with xyflow's `getBoundingClientRect` measurement and produces NaN edge paths.
- Don't reintroduce a fixed height or `display: flex` on `.fr-op-node` without re-verifying edge connectivity.
- Don't use `.detail-tab` in new Hub components. Use `.tab` (the Hub variant with coral underline).
- Don't compose `<Shell>` / `<Sidebar>` / `<Header>` (legacy) with Hub innards. Hub uses `<HubShell>` / `<HubTopBar>` / `<HubSidebar>` exclusively.

## Responsive Behavior

### Breakpoints

The Hub is designed for 1440px+. Below tablet (768px) is explicitly out of scope.

| Name | Width | Key Changes |
|---|---|---|
| Tablet | 1024–1280px | Right rail collapses (renders below main content); kanban becomes horizontal-scroll; KPI quad collapses 4→2 |
| Desktop | 1280–1440px | Full 240/1fr/300px page-grid; rail visible; KPI quad 4-up |
| Wide | > 1440px | Same as desktop with additional outer breathing room |
| Below tablet | < 1024px | Out of scope for Hub v1 |

### Touch Targets

- `<Button>` / `.btn` — minimum 36×36px (slightly under WCAG 44, visually centered for desktop density)
- `.btn-primary` — 40×40px when used as the primary surface CTA
- `.form-input` — 36px height (input.tsx uses Tailwind `h-9` = 36px)
- Sidebar nav-item — entire row is tappable; effective area ~32px tall

### Collapsing Strategy

- The 240/1fr/300px grid collapses to 240/1fr at < 1280px. Rail content stacks below main.
- KPI quad collapses 4-up → 2-up via `lg:col-span-*` and `grid-cols-1 lg:grid-cols-3` at 1024px (see `routes/hub/index.tsx`).
- Kanban columns retain 280px width at every breakpoint and trigger horizontal-scroll on the column container.
- Log viewer retains mono font-size; horizontal scroll on the container rather than wrapping log lines.
- DAG (`.fr-op-node`) stays 320px wide at every breakpoint; pan/zoom controls via `.react-flow__controls`.
- Top-bar collapses cluster pill to icon-only at < 1024px; search button stays.

## Iteration Guide

When adding or porting a Hub primitive, follow the 6-step procedure from `console-v2/CLAUDE.md`:

1. **Find the visual in `console-v2/`.** Open the matching mockup HTML end-to-end. If the visual doesn't exist in a mockup, design it in HTML first — `console-v2/` is the visual contract.
2. **Locate the CSS in `console-v2/shared/styles.css`.** Port the rule into `packages/ui/src/styles/hub.css`. Substitute literal hex values for `var(--color-fr-*)` tokens.
3. **Use `var(--font-sans)` / `var(--font-mono)`** — never `var(--font-geist-mono)`.
4. **Mirror new tokens** into BOTH `packages/ui/src/styles/tokens.css` AND `dashboard/src/global.css` `@theme` block.
5. **Add a typed React wrapper** if the primitive is stateful or composes child slots. Pure-styling primitives stay as raw CSS classes (e.g., `.engine-callout`).
6. **Export from `packages/ui/src/index.ts`** and verify the dashboard imports work. Both `packages/ui/package.json` exports and `dashboard/src/global.css` may need updating for new CSS files.

### Verification checklist

- Renders correctly at `/hub/<path>` in the dashboard
- Sidebar highlights the active section
- Cluster env tint matches (prod=rose, stage=amber, dev=teal)
- No undefined `var(--color-*)` warnings in browser DevTools
- Navigation stays client-side (no full page reload — confirms `LinkComponent` is wired)
- `pnpm build` is green (Tailwind v4 resolves all utility classes)

### Tooling

- `pnpm ui:search "<query>"` — semantic search over the `@flink-reactor/ui` component embeddings before adding a new primitive. Catches duplicates.
- `/hub/sandbox` — kitchen-sink visual verification route (legacy P0–P3 primitives).
- `/hub/primitive-sandbox` — kitchen-sink for newer P4 primitives.

## Known Gaps & Risks

- **Theme parity** — Tokyo Night and Gruvpuccin Light tokens are defined in `tokens.css` and `global.css`, but Hub v1 forces dark-only at the route boundary. Light + Tokyo Night for Hub ship as separate changes (`fr-console-hub-light-theme`, `fr-console-hub-tokyo-night`). Verify `<html class="light">` does not break Hub routes — current behavior is undefined.
- **No animation tokens** — the system uses ad-hoc keyframes (`live-pulse`, `dash-flow`, `tap-row-flash`, `accordion-down/up`) without a documented duration/easing scale. Future change: lift to tokens.
- **Two button systems** — raw `.btn` (Hub layout chrome) vs `<Button>` Radix variants (typed forms). The boundary "raw for chrome, Radix for forms" is convention only; not enforced.
- **`{colors.fr-purple}` deprecated** — alias for `{colors.fr-sage}`, kept "for one release" per `tokens.css:17`. Don't reach for it; flag the removal cliff in code review.
- **No nested route layout** — every Hub route hand-rolls `<HubShell>` rather than inheriting from a parent layout route. Future refactor target.
- **`HUB_SIDEBAR_SECTIONS` config inline** — currently lives inline in `sandbox.tsx` and is documented as needing extraction to `dashboard/src/lib/hub-sidebar-sections.ts` once the second route lands. Until then, copy carefully when adding routes.
- **Demo data in overview** — engine bars + checkpoint heatmap fall back to seeded demo data when the backend doesn't provide real series. Flagged via `engineBarsAreDemo` / `heatmapIsDemo` in `routes/hub/index.tsx`.
- **No formal focus-ring spec** — focus styling is per-component. `.form-input` uses a 1px coral box-shadow ring; `.btn` has no defined focus state. Ad-hoc focus rings are a regression risk for keyboard accessibility.
- **Iconography stroke** — `stroke-width: 1.6` overrides at the top of `hub.css` are scoped to specific selectors and not yet a token. Future change: lift to `--stroke-hub-chrome`.
- **Accessibility** — `aria-label` is mentioned in route rules but no centralized a11y rule sheet exists. Status icons that convey state via shape (`.acknowledged` conic) need `aria-label` to be screen-reader accessible.
- **Mockup ↔ React drift** — when the mockup and the React port disagree, the mockup wins per `console-v2/CLAUDE.md`. No automated drift detection exists; rely on visual review during PR.
- **Brand glyph not a token** — `<BrandGlyph>` is a custom SVG asset, not a system token. The lockup (glyph + wordmark + ALPHA chip) is enforced by convention.
- **DAG xyflow `!important` debt** — handle and edge styles use `!important` because xyflow's CSS lands unlayered. The constraint is documented in `hub.css` comments but not in component code; raise specificity carefully if adjusting.
- **Marketing surface (out of scope)** — this doc covers the FlinkReactor Hub product surface. Marketing site, legacy dashboard chrome (`Shell`/`Sidebar`/`Header`), and other surfaces have separate (or no) design specs.
