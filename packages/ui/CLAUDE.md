# @flink-reactor/ui

Design system package for FlinkReactor applications. Gruvpuccin (default) + Tokyo Night themes, Radix UI primitives, Tailwind CSS.

## Package Structure

```
packages/ui/src/
├── components/ui/     # 30 UI primitives (Radix-based + composition components)
├── layout/            # 4 app layout components
├── shared/            # 7 domain-specific components
├── themes/            # CodeMirror editor themes (Gruvpuccin, Tokyo Night)
├── lib/               # Utilities (cn, constants)
└── styles/            # CSS design tokens + component classes
```

All public components and types are exported from `src/index.ts`.

## Adding to a Next.js App

Full installation guide: `web/content/docs/ui/installation.mdx`

Quick summary:
1. `pnpm add @flink-reactor/ui@workspace:*` (monorepo) or use `create-fr-app add` (external)
2. Install peers: `pnpm add geist lucide-react`
3. Set up Tailwind v4: `@tailwindcss/postcss` in `postcss.config.mjs`
4. Import styles: `@import "@flink-reactor/ui/styles"` in global CSS, or inline `@theme` tokens
5. Configure Geist fonts on `<html>` element with `GeistSans.variable` + `GeistMono.variable`
6. Import components: `import { Button, Card, Shell } from "@flink-reactor/ui"`

Reference implementation: `apps/dashboard/` (uses local layout wrappers over UI primitives with Zustand state)

## Semantic Search

This package has a vector embedding index (LanceDB + nomic-embed-text-v2-moe) for efficient exploration.

```bash
pnpm ui:search "your query here"                # Search component embeddings
pnpm ui:search "sidebar navigation" --top-k 3   # Limit results
pnpm ui:embed                                    # Rebuild index after changes
pnpm ui:benchmark                                # Re-run model comparison
```

## Component Reference

### UI Primitives (`components/ui/`)

| Component | File | Key Props / Notes |
|-----------|------|-------------------|
| **Accordion** | `accordion.tsx` | Radix Accordion: Accordion, AccordionItem, AccordionTrigger, AccordionContent. `type`: single/multiple |
| **Button** | `button.tsx` | `variant`: default/secondary/destructive/outline/ghost/link. `size`: default/sm/lg/icon |
| **ButtonGroup** | `button-group.tsx` | Groups buttons with coordinated border-radius. `orientation`: horizontal/vertical |
| **Badge** | `badge.tsx` | `variant`: default/secondary/destructive/outline |
| **Card** | `card.tsx` | Compound: Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter |
| **Checkbox** | `checkbox.tsx` | Radix Checkbox with check indicator |
| **Combobox** | `combobox.tsx` | Searchable select with autocomplete, groups, built on cmdk |
| **Collapsible** | `collapsible.tsx` | Radix Collapsible: Collapsible, CollapsibleTrigger, CollapsibleContent |
| **Dialog** | `dialog.tsx` | Radix Dialog: Dialog, DialogTrigger, DialogContent, DialogHeader, etc. |
| **DropdownMenu** | `dropdown-menu.tsx` | Radix DropdownMenu: DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, etc. |
| **Field** | `field.tsx` | Form field composition: Field, FieldLabel, FieldContent, FieldDescription, FieldError, FieldSet |
| **HoverCard** | `hover-card.tsx` | Radix HoverCard: HoverCard, HoverCardTrigger, HoverCardContent |
| **HubBreadcrumb** | `hub-breadcrumb.tsx` | Hub page-header breadcrumb. Crumbs `[{label, to?, mono?}]` with `/` separators. Last crumb is non-link. Pass `LinkComponent` for router-aware nav. |
| **Input** | `input.tsx` | Standard `<input>` with theme styling |
| **InputGroup** | `input-group.tsx` | Wraps Input with leading/trailing addons (icons, buttons, text) |
| **Item** | `item.tsx` | Versatile list/card container: Item, ItemMedia, ItemContent, ItemTitle, ItemDescription, ItemActions |
| **Kbd** | `kbd.tsx` | Keyboard shortcut display: Kbd, KbdGroup |
| **Label** | `label.tsx` | Radix Label primitive |
| **Popover** | `popover.tsx` | Radix Popover: Popover, PopoverTrigger, PopoverContent |
| **Progress** | `progress.tsx` | Radix Progress bar with gradient indicator |
| **Resizable** | `resizable.tsx` | react-resizable-panels: ResizablePanelGroup, ResizablePanel, ResizableHandle |
| **Select** | `select.tsx` | Radix Select: Select, SelectTrigger, SelectContent, SelectItem, etc. |
| **Separator** | `separator.tsx` | Radix Separator (horizontal/vertical) |
| **Sheet** | `sheet.tsx` | Side panel overlay: Sheet, SheetTrigger, SheetContent, SheetHeader, etc. `side`: top/right/bottom/left |
| **Skeleton** | `skeleton.tsx` | Animated loading placeholder |
| **Spinner** | `spinner.tsx` | Loading indicator: `size`: sm/default/lg. `role="status"` with aria-label |
| **Switch** | `switch.tsx` | Radix Switch toggle |
| **Table** | `table.tsx` | Compound: Table, TableHeader, TableBody, TableRow, TableHead, TableCell, etc. |
| **Tabs** | `tabs.tsx` | Radix Tabs: Tabs, TabsList, TabsTrigger, TabsContent |
| **Textarea** | `textarea.tsx` | Standard `<textarea>` with theme styling |
| **Tooltip** | `tooltip.tsx` | Radix Tooltip: Tooltip, TooltipTrigger, TooltipContent, TooltipProvider |

### Layout Components (`layout/`)

> **Two layout systems coexist during the Hub migration.** `Shell`/`Sidebar`/`Header` serve the legacy `dashboard/src/routes/*` tree. `HubShell`/`HubTopBar`/`HubSidebar` serve `dashboard/src/routes/hub/*`. The cutover change (`fr-console-hub-cutover`) deletes the legacy set and renames the Hub set to drop the prefix.

| Component | Props | Purpose |
|-----------|-------|---------|
| **Shell** (legacy) | `sidebar`, `header`, `commandPalette`, `onCommandPalette` | Full-screen app shell. Handles Cmd+K/Ctrl+K shortcut. |
| **Sidebar** (legacy) | `navGroups: NavGroup[]`, `collapsed`, `activePath`, `LinkComponent`, `brandName` | Collapsible nav sidebar with grouped items. Pass custom `LinkComponent` for your router. |
| **Header** (legacy) | `breadcrumbs: Breadcrumb[]`, `rootLabel`, `rightContent` | Top bar with breadcrumb navigation. Use `breadcrumbFromPath(pathname)` helper. |
| **CommandPalette** (legacy) | `open`, `onClose`, `onNavigate`, `routes: CommandRoute[]` | Modal search palette for quick navigation. |
| **HubShell** | `topBar`, `sidebar`, `rail?`, `children` | Hub shell. Composes top-bar + sidebar + main + optional right rail. |
| **HubTopBar** | `cluster?`, `clusterSlot?`, `onClusterClick?`, `onSearchOpen?`, `LinkComponent?` | Hub top bar with brand glyph, cluster pill, search button (opens palette via `onSearchOpen`). Pass `clusterSlot` to wrap the pill in a custom Popover. |
| **HubSidebar** | `sections: HubSidebarSection[]`, `activePath`, `LinkComponent` | 240px sectioned nav. Section headings render via `.section-heading`. |
| **HubCommandPalette** | `open`, `onClose`, `onNavigate`, `routes: HubCommandRoute[]` | Rethemed cmdk dialog with grouped routes, hint kbd shortcuts, mono input, footer kbd hints. Use Cmd+K / Ctrl+K to toggle. |

### Shared Components (`shared/`)

| Component | Props | Purpose |
|-----------|-------|---------|
| **MetricCard** | `icon`, `label`, `value`, `accent` | Glass-effect card for single metrics. Uses `.glass-card` CSS. |
| **EmptyState** | `icon?`, `message?`, `title?`, `description?`, `children?` | Centered placeholder for empty content areas. Supports simple (icon+message) or rich (title+description+action buttons) modes. |
| **TextViewer** | `text`, `maxHeight`, `showLineNumbers`, `showCopyButton` | Readonly monospace text pane with line numbers and copy. |
| **SearchInput** | `value`, `onChange`, `isRegex`, `onRegexChange`, `matchCount`, `currentIndex`, `onNext`, `onPrev` | Search box with regex toggle, match counter, prev/next navigation. |
| **SeverityBadge** | `level: LogLevel` | Colored badge for TRACE/DEBUG/INFO/WARN/ERROR levels. |
| **SourceBadge** | `source: LogSource` | Log source badge (JM, TM-1, CLI abbreviations). |
| **TimeRange** | `value: TimeRangeValue`, `onChange`, `presets?` | Quick-select time range buttons (5m, 15m, 1h, 6h, 24h, All). |

## Theme Tokens (`styles/tokens.css`)

| Category | Tokens | Values |
|----------|--------|--------|
| **Brand** | `--color-fr-bg`, `--color-fr-coral`, `--color-fr-purple`, `--color-fr-amber` | Dark backgrounds + coral/purple/amber accents |
| **Severity** | `--color-log-trace/debug/info/warn/error` | Tokyo Night blues/yellows/reds for log levels |
| **Dashboard** | `--color-dash-surface/panel/elevated/border/hover` | Layered dark surface tokens |
| **Job Status** | `--color-job-running/finished/cancelled/failed/created` | Green/blue/yellow/red/gray for Flink job states |

## CSS Component Classes (`styles/components.css`)

- `.glass-card` — Glassmorphism card with backdrop-filter blur, hover border glow
- `.log-line` / `.log-line-selected` / `.log-line-error` / `.log-line-warn` — Log row styles
- `.severity-badge` / `.source-badge` — Monospace badge styles
- `.detail-tabs-list` / `.detail-tab` — Tab panel styles with purple active indicator
- `.data-row` / `.data-row-selected` — Table row hover/selection states
- `.scrollbar-hide` — Cross-browser scrollbar hiding

## Hub CSS Classes (`styles/hub.css`) — separate import

Hub-specific classes live in `hub.css` (NOT `components.css`) and are exported as `@flink-reactor/ui/styles/hub`. Apps must import them explicitly — they are not auto-included with `@flink-reactor/ui/styles`. This keeps the legacy bundle clean and lets the cutover change collapse `hub.css` → `components.css` atomically.

| Class | Purpose |
|---|---|
| `.glass-card-static` | Container card without hover transform (Hub uses these for non-interactive surfaces) |
| `.live-dot` | Pulsing status indicator |
| `.sev-badge` | OK/WARN/FAIL/INFO/MUTED/CORAL pills (monospace) |
| `.priority` / `.bar` | P5..P1 stacked-bar priority indicator |
| `.status-icon` (+ state classes: `.firing`, `.acknowledged`, `.in-progress`, `.resolved`, `.suppressed`, `.silenced`) | 6 alert states with conic-gradient rings |
| `.hm-0` … `.hm-4` | Heatmap intensity scale (sage low → coral high) |
| `.diff-line` (+ `.added`, `.removed`, `.hunk`) | Diff rows. **No left-border accents** — uses background tint only. |
| `.kanban-col` / `.kanban-card` / `.add-card` | Deployment board columns and tiles |
| `.kpi-card` | Mono-styled metric card (used inside `<KpiCard>`) |
| `.section-heading` | Sidebar group label / card section title |
| `.cluster-selector` (+ `.env.prod`, `.env.stage`, `.env.dev`) | Top-bar cluster pill with environment color tint |
| `.state-pill` (+ state modifiers) | Done/active/pending/failed deployment pills |
| `.prop-chip` (+ `.active`) | Toggleable filter chip |
| `.label-chip` | Static label badge |
| `.tab` (+ `.active`) | Underlined sub-nav tab |
| `.activity-entry` | Activity timeline row |
| `.file-tree-row` | Catalog tree row |
| `.log-viewer` / `.log-row` / `.log-level` | Hub log viewer (replaces legacy `.log-line`) |
| `.code-viewer` / `.tk-key` / `.tk-str` / `.tk-num` / `.tk-com` / `.tk-typ` / `.tk-fn` / `.tk-pun` / `.tk-op` / `.tk-attr` | Faux syntax highlighting (no actual tokenizer) |
| `.resource-bar` (+ `.seg.heap`, `.managed`, `.network`) | TaskManager memory bar |
| `.sparkbar` | Simulation outcome sparkline |
| `.health-ring` | Health page conic-gradient ring |
| `.dot-grid` | Overview surface texture |
| `.engine-callout` | Engine bars hover popover |

## Code Patterns

1. **All components use `"use client"` directive** (React client components)
2. **`cn()` from `lib/cn.ts`** — wraps `tailwind-merge` + `clsx` for className merging
3. **Icons from `lucide-react`** — passed as component props (`icon: LucideIcon`)
4. **Router-agnostic links** — Layout components accept `LinkComponent` prop for Next.js Link / React Router / etc.
5. **No default exports** — all components use named exports
6. **Unified Radix** — UI primitives use `import { X } from "radix-ui"` (unified package, not individual `@radix-ui/react-*`)
7. **data-slot attributes** — Compound component sub-parts have `data-slot` attributes for CSS targeting

## Hub Layout Conventions (P0-P5 migration)

The Hub layout system follows additional rules on top of the patterns above. These rules are encoded in `dashboard/src/routes/hub/CLAUDE.md` and the `console-v2/CLAUDE.md` mockup contract.

### Hard rules

1. **No colored left-border accents on cards, rows, list items, or diff rows.** Status conveyed via pills, dots, background tints, or filled icons. The `.diff-line` styles are the canonical example (added → green-tinted background, NOT green left border).
2. **`<HubShell>` always wraps the main column AND the optional right rail in a `display: grid` parent.** Required so `min-height: 100%` on the rail eliminates dead space below short main content.
3. **Right rail is never empty.** Provide a fallback (job summary card, instrument summary, etc.) — never an empty column. The DAG-page whitespace bug came from violating this.
4. **`LinkComponent` is required on `HubSidebar` and any nav primitive that emits anchors.** Never hardcode `<a href>` or import a router directly into `packages/ui` — keeps the package router-agnostic.
5. **All hex values resolve through `var(--color-fr-*)`.** No literal hex in Hub CSS or component class strings. Audit on PRs.
6. **Tailwind utility classes must be statically discoverable.** Templated class names like `text-${tone}` don't generate utilities. Use object lookups with full string values: `const TONE = { sage: "text-fr-sage", coral: "text-fr-coral" }`.
7. **Token mirroring**: any new Hub token added to `packages/ui/src/styles/tokens.css` MUST also be mirrored into the dashboard's inline `@theme` block in `dashboard/src/global.css`. The dashboard does not consume `tokens.css` via CSS import — it uses Tailwind's `@theme` directive.

### When adding a Hub primitive

1. **Check console-v2 first.** If the visual exists in a static mockup, port it. Match pixel-for-pixel.
2. **CSS class first, then React wrapper if stateful.** Pure-styling primitives stay as CSS classes (e.g., `.engine-callout`). React wrappers exist only when there's state, prop variation, or composition logic.
3. **Add to `hub.css`, not `components.css`.** Until cutover.
4. **Export from `src/index.ts` AND verify the dashboard imports work.** Both `packages/ui/package.json` exports field and `dashboard/global.css` need updating for new CSS files.
5. **Run the sandbox.** `/hub/sandbox` should render every primitive. Add the new one there.

### When working in `dashboard/src/routes/hub/`

- Wrap content in `<HubShell topBar={...} sidebar={...} rail={...}>` — never compose `<Shell>` (legacy) and Hub innards.
- Use the canonical sidebar sections from the mockups; don't reorder.
- Force dark mode at the route boundary if mounting outside `__root.tsx` (Hub v1 is dark-only).
- See `dashboard/src/routes/hub/CLAUDE.md` for the full Hub-route playbook.

## When Working on This Package

1. **Adding a UI primitive**: Follow patterns in `components/ui/` (Radix wrapper + styled with `cn()`)
2. **Adding a shared component**: Follow patterns in `shared/` (JSDoc, typed props interface, named export)
3. **Adding tokens**: Update `styles/tokens.css` and re-export from `lib/constants.ts`
4. **After changes**: Update `src/index.ts` exports, then `pnpm ui:embed` to refresh the search index
