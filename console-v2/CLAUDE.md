# console-v2 — Static Mockup Suite

This directory is the **visual contract** for the FlinkReactor Hub redesign. 29 hand-written HTML pages prototyping every dashboard surface in the new design language (Linear-quality, Gruvpuccin tones, glass cards, status icons, kanban, heatmaps).

**Not runtime code.** Do not import this directory from `dashboard/src/`. Treat it as the source of truth when porting visuals to React under `packages/ui/` and `dashboard/src/routes/hub/`.

## Canonical sources (read these when in doubt)

| Need | Read this |
|---|---|
| Brand glyph SVG (concentric rings) | `shared/icons.js` → `window.fr.brandGlyph(size)` |
| Color palette (hex values) | `shared/tw-config.js` (Tailwind extend) |
| All CSS primitives (`.glass-card`, `.kanban-*`, `.diff-line`, `.tk-*`, etc.) | `shared/styles.css` |
| Heatmap and engine-bars JS | `shared/icons.js` → `buildHeatmap`, `buildEngineBars` |
| Page chrome (top bar + sidebar markup) | `overview.html` (the canonical layout reference) |
| Job-detail page with DAG + side rail | `job.html` |
| Deployment kanban — column headers, card variants, empty states, add-card | `deployments.html` |
| Schema diff viewer | `instrument-schema-registry.html` |
| Full-bleed editor layout | `sql-explorer.html`, `sandbox.html` |

## Hard rules (carried forward to every Hub page)

1. **No left-border accents** anywhere — cards, rows, list items, diff lines. Status conveyed via pills, dots, background tints, or filled icons. The `.diff-line` styles in `shared/styles.css` are the canonical example (background tint only).
2. **Geist Sans (UI) + Geist Mono (data)**. Mono is used for IDs, timestamps, KPI values, code, and uppercase mono labels.
3. **Brand lockup**: concentric coral rings glyph + `flinkreactor.hub` wordmark + `ALPHA` chip. Always together in the top bar.
4. **Section heading style**: mono uppercase 10px, `letter-spacing: 0.1em`, color `--color-fg-dim`. Used for sidebar group labels and card titles.

## Porting a primitive — the correct sequence

This is the procedure that *should* have been followed from the start. Five places need updating; missing any one of them produces a silent visual regression.

### 1. Find the primitive in `shared/styles.css`

Each primitive has its own `── ── ──` section. The class names are unprefixed (`.kanban-col`, `.priority`, `.kpi-card`).

### 2. Port to `packages/ui/src/styles/hub.css`

Append to the bottom. Convert every hardcoded hex value to a CSS variable.

```css
/* WRONG (mockup form, hex hardcoded) */
.live-dot {
  background: #a9b665;
  box-shadow: 0 0 10px rgba(169, 182, 101, 0.7);
}

/* RIGHT (Hub form, tokens) */
.live-dot {
  background: var(--color-fr-sage);
  box-shadow: 0 0 10px var(--color-fr-sage-glow);
}
```

### 3. If the primitive uses fonts, use the dashboard's variable names

The dashboard defines `--font-sans` and `--font-mono`. **Not** `--font-geist-sans` / `--font-geist-mono`. A wrong reference resolves silently to the parent's font and the bug is hard to spot.

```css
/* WRONG — silently falls back to Geist Sans */
font-family: var(--font-geist-mono);

/* RIGHT */
font-family: var(--font-mono);
```

### 4. Add any new color tokens to **both** token sources

This is the most common mistake. The dashboard has its own `@theme` block in `dashboard/src/global.css` — it does *not* import `packages/ui/styles/tokens.css`. New tokens must be added to both:

- `packages/ui/src/styles/tokens.css` (for external consumers)
- `dashboard/src/global.css` (for the dashboard's Tailwind v4 utility generation)

Without the token in the dashboard's `@theme`, `var(--color-fr-sage)` resolves to nothing and `bg-fr-sage` utility doesn't exist.

### 5. If the primitive benefits from a typed React API, add a component

In `packages/ui/src/components/ui/`. Pure-CSS classes don't get React wrappers (e.g., `.activity-entry`, `.dot-grid`, `.code-viewer`). Add components for stateful primitives (`<StatusIcon>`, `<PriorityBars>`, `<KpiCard>`, `<DiffViewer>`).

Layout components go in `packages/ui/src/layout/`, not `packages/ui/src/components/layout/`.

### 6. Export from `packages/ui/src/index.ts`

Both the component and any prop/state types it owns. Keep alphabetical position alongside existing exports.

## Reading mockup markup vs porting it

Mockup HTML uses raw lucide icons (`<i data-lucide="play"></i>`). The React port uses `lucide-react` imports (`import { Play } from "lucide-react"`). The icon names match 1:1.

Mockup HTML uses raw `<button class="btn btn-ghost btn-sm btn-icon">`. The Hub layout components use the `.btn` classes directly (matching the mockup) — they do **not** route through the existing `<Button>` primitive (which has its own variant system). For Hub-specific places, write raw `<button className="btn btn-ghost ...">` to preserve the exact mockup look.

## Common pitfalls observed (don't repeat these)

| Pitfall | What goes wrong | Fix |
|---|---|---|
| Adding tokens only to `packages/ui/styles/tokens.css` | Color swatches render as transparent boxes; `text-fr-sage` utility undefined in dashboard | Mirror tokens into `dashboard/src/global.css` `@theme` |
| Using `var(--font-geist-mono)` | Silent fallback to body font; no error | Use `var(--font-mono)` |
| Adding Hub CSS to `packages/ui/styles/components.css` | Dashboard doesn't import that file; classes never load | Append to `hub.css` (split file) and `@import "@flink-reactor/ui/styles/hub";` from dashboard `global.css` |
| Templated Tailwind classes like `text-${tone}` | Tailwind v4's static scanner misses them; utility never generated | Use static class strings, one branch per case |
| Putting layout components in `components/layout/` | Wrong package convention; existing layout lives in `packages/ui/src/layout/` | Use `packages/ui/src/layout/` |
| Skipping mockup details (avatars, version pills, empty states) | Page looks "right at a glance" but obviously wrong on close inspection | Read the source HTML page end-to-end before writing the React version |
| Forgetting `.add-card`, `.nav-item`, `.btn`, `.form-input`, `.page-grid` because mockup HTML uses them inline | Layout collapses, icons stack vertically, search input has no border | Grep mockup HTML for every class name; ensure each is defined in `hub.css` |

## How to verify visual parity

1. `pnpm dev` and open `/hub/sandbox` next to the relevant mockup page (e.g., open `console-v2/overview.html` directly via `python3 -m http.server` or `file://`).
2. Match section by section. Key spots that drift first: top bar (cluster selector PROD pill), sidebar (icon alignment, count tones), kanban column headers, empty states, hover states.
3. Inspect the rendered DOM: check that `<button class="cluster-selector"><span class="env prod">prod</span>...</button>` has the `.env.prod` styles applied (rose tint + rounded badge with horizontal padding).
4. Inspect computed font: cluster name, search placeholder, card-id should be Geist Mono. If they're Geist Sans, the variable reference is wrong.

## Out of scope for this directory

- Real React rendering — port to `packages/ui` and `dashboard/src/routes/hub/`.
- Light mode and Tokyo Night — Hub v1 is dark-only; those are separate follow-up changes.
- Mobile responsive — designed for 1440px+.
- Backend wiring — mockups use seeded demo data; real data comes via existing GraphQL stores.

## Related

- Migration plan: `~/.claude/plans/the-plan-claude-plans-there-s-a-trend-to-staged-tide.md`
- OpenSpec changes (one per phase): `~/Development/reactors/flink/flink-reactor-specs/openspec/changes/fr-console-hub-*`
- Kitchen-sink demo: `dashboard/src/routes/hub/sandbox.tsx` (URL `/hub/sandbox`)
