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

| Component | Props | Purpose |
|-----------|-------|---------|
| **Shell** | `sidebar`, `header`, `commandPalette`, `onCommandPalette` | Full-screen app shell. Handles Cmd+K/Ctrl+K shortcut. |
| **Sidebar** | `navGroups: NavGroup[]`, `collapsed`, `activePath`, `LinkComponent`, `brandName` | Collapsible nav sidebar with grouped items. Pass custom `LinkComponent` for your router. |
| **Header** | `breadcrumbs: Breadcrumb[]`, `rootLabel`, `rightContent` | Top bar with breadcrumb navigation. Use `breadcrumbFromPath(pathname)` helper. |
| **CommandPalette** | `open`, `onClose`, `onNavigate`, `routes: CommandRoute[]` | Modal search palette for quick navigation. |

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

## Code Patterns

1. **All components use `"use client"` directive** (React client components)
2. **`cn()` from `lib/cn.ts`** — wraps `tailwind-merge` + `clsx` for className merging
3. **Icons from `lucide-react`** — passed as component props (`icon: LucideIcon`)
4. **Router-agnostic links** — Layout components accept `LinkComponent` prop for Next.js Link / React Router / etc.
5. **No default exports** — all components use named exports
6. **Unified Radix** — UI primitives use `import { X } from "radix-ui"` (unified package, not individual `@radix-ui/react-*`)
7. **data-slot attributes** — Compound component sub-parts have `data-slot` attributes for CSS targeting

## When Working on This Package

1. **Adding a UI primitive**: Follow patterns in `components/ui/` (Radix wrapper + styled with `cn()`)
2. **Adding a shared component**: Follow patterns in `shared/` (JSDoc, typed props interface, named export)
3. **Adding tokens**: Update `styles/tokens.css` and re-export from `lib/constants.ts`
4. **After changes**: Update `src/index.ts` exports, then `pnpm ui:embed` to refresh the search index
