<p align="center">
  <!-- SCREENSHOT: Create a UI package banner (1200x300) showing:
       - "@flink-reactor/ui" text
       - A mosaic of component previews (Button variants, Card, Badge, Sidebar)
       - Tokyo Night dark background with subtle glassmorphism
       - Save as .github/assets/ui-hero.png (repo root) -->
  <img src="../../.github/assets/ui-hero.png" alt="@flink-reactor/ui — Design system for FlinkReactor" width="100%" />
</p>

<p align="center">
  <strong>Design system and component library for FlinkReactor applications.</strong><br />
  Radix UI primitives, Tokyo Night palette, Tailwind CSS v4, glassmorphism styling.
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@flink-reactor/ui"><img src="https://img.shields.io/npm/v/@flink-reactor/ui?color=d97085&label=npm" alt="npm version" /></a>
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="license" /></a>
  <img src="https://img.shields.io/badge/react-18%20%7C%2019-61dafb" alt="React 18 | 19" />
  <img src="https://img.shields.io/badge/tailwind-v4-06b6d4" alt="Tailwind CSS v4" />
  <img src="https://img.shields.io/badge/radix_ui-primitives-7c3aed" alt="Radix UI" />
</p>

<p align="center">
  <a href="https://flink-reactor.dev/docs/ui">Documentation</a> &middot;
  <a href="#component-catalog">Components</a> &middot;
  <a href="#theming">Theming</a> &middot;
  <a href="https://github.com/sandboxws/flink-reactor/issues">Issues</a>
</p>

<br />

## What's Inside

```
27 components  ·  4 theme palettes  ·  Router-agnostic  ·  Tree-shakeable ESM
```

<!-- SCREENSHOT: Create a component showcase image (1200x500) showing:
     - A grid of live components: Button variants, Badge variants, Card, Dialog,
       MetricCard (glassmorphism), Sidebar (collapsed + expanded), Tabs
     - All rendered against Tokyo Night dark background
     - Save as .github/assets/ui-components.png (repo root) -->
<p align="center">
  <img src="../../.github/assets/ui-components.png" alt="Component showcase — buttons, cards, badges, sidebar, metrics" width="100%" />
</p>

<br />

## Quick Start

```bash
npm install @flink-reactor/ui react react-dom
```

Add styles to your global CSS:

```css
@import "@flink-reactor/ui/styles";
```

Use components:

```tsx
import { Button, Card, CardContent, CardHeader, CardTitle, Shell, Sidebar } from "@flink-reactor/ui";

export function MyApp() {
  return (
    <Shell sidebar={<Sidebar navGroups={[...]} />}>
      <Card>
        <CardHeader>
          <CardTitle>Pipeline Status</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="secondary" size="sm">View Details</Button>
        </CardContent>
      </Card>
    </Shell>
  );
}
```

<br />

## Component Catalog

### UI Primitives (16)

| Component | Key Props |
|-----------|-----------|
| **Button** | `variant`: default / secondary / destructive / outline / ghost / link — `size`: default / sm / lg / icon |
| **Badge** | `variant`: default / secondary / destructive / outline |
| **Card** | Compound: `Card` `CardHeader` `CardTitle` `CardDescription` `CardContent` `CardFooter` |
| **Input** | Standard `<input>` with theme styling |
| **Label** | Radix Label with peer-disabled states |
| **Textarea** | Standard `<textarea>` with theme styling |
| **Table** | Compound: `Table` `TableHeader` `TableBody` `TableRow` `TableHead` `TableCell` |
| **Tabs** | Radix Tabs: `Tabs` `TabsList` `TabsTrigger` `TabsContent` |
| **Dialog** | Radix Dialog with overlay, close button, header/footer slots |
| **Tooltip** | Radix Tooltip with portal rendering |
| **Select** | Radix Select with scroll buttons and check indicators |
| **Popover** | Radix Popover with configurable alignment |
| **HoverCard** | Radix HoverCard for rich preview content |
| **Collapsible** | Radix Collapsible for expandable sections |
| **Progress** | Gradient progress bar |
| **Separator** | Horizontal / vertical divider |
| **Resizable** | `ResizablePanelGroup` `ResizablePanel` `ResizableHandle` |

### Layout (4)

| Component | Props | Purpose |
|-----------|-------|---------|
| **Shell** | `sidebar` `header` `commandPalette` | Full-screen app shell with Cmd+K shortcut |
| **Sidebar** | `navGroups` `collapsed` `activePath` `LinkComponent` `brandName` | Collapsible navigation with grouped items |
| **Header** | `breadcrumbs` `rootLabel` `rightContent` | Top bar with breadcrumb navigation |
| **CommandPalette** | `open` `onClose` `onNavigate` `routes` | Modal search palette for quick navigation |

### Shared (7)

| Component | Purpose |
|-----------|---------|
| **MetricCard** | Glassmorphism metric display with icon, label, value, and accent color |
| **EmptyState** | Centered placeholder for empty content areas |
| **TextViewer** | Readonly monospace text pane with line numbers and copy-to-clipboard |
| **SearchInput** | Search box with regex toggle, match counter, and prev/next navigation |
| **SeverityBadge** | Colored badge for log levels: TRACE / DEBUG / INFO / WARN / ERROR |
| **SourceBadge** | Log source badge with abbreviations (JM, TM-1, CLI) |
| **TimeRange** | Quick-select time range buttons (5m, 15m, 1h, 6h, 24h, All) |

<br />

## Theming

Four palettes ship out of the box. Toggle with a `data-theme` attribute on your root element:

<!-- SCREENSHOT: Create a 2x2 grid showing the same Card + Button + Badge rendered in
     each of the 4 themes. Save as .github/assets/ui-themes.png (repo root) -->
<p align="center">
  <img src="../../.github/assets/ui-themes.png" alt="Four theme palettes — Tokyo Night dark/light, Gruvpuccin dark/light" width="100%" />
</p>

| Attribute | Palette |
|-----------|---------|
| _(default)_ | Tokyo Night Dark |
| `data-theme="light"` | Tokyo Night Light |
| `data-theme="gruvpuccin"` | Gruvpuccin Dark |
| `data-theme="gruvpuccin-light"` | Gruvpuccin Light |

### Token Categories

| Category | Examples | Use for |
|----------|---------|---------|
| **Brand** | `--color-fr-bg` `--color-fr-coral` `--color-fr-purple` `--color-fr-amber` | Backgrounds, accents |
| **Surfaces** | `--color-dash-surface` `--color-dash-panel` `--color-dash-elevated` | Layered dark surfaces |
| **Foreground** | `--color-fg` `--color-fg-secondary` `--color-fg-muted` `--color-fg-dim` | Text hierarchy |
| **Severity** | `--color-log-trace` through `--color-log-error` | Log level indicators |
| **Job Status** | `--color-job-running` `--color-job-finished` `--color-job-cancelled` `--color-job-failed` | Flink job state |

### CSS Component Classes

```css
.glass-card          /* Glassmorphism card with backdrop-filter blur + hover glow */
.log-line            /* Log row base styles */
.severity-badge      /* Monospace severity badge */
.detail-tabs-list    /* Tab panel with purple active indicator */
.data-row            /* Table row with hover/selection states */
.scrollbar-hide      /* Cross-browser scrollbar hiding */
```

<br />

## Setup Guide

### 1. Install

```bash
npm install @flink-reactor/ui
```

Peer dependencies:
```bash
npm install react react-dom
```

### 2. Fonts (recommended)

```bash
npm install geist
```

```tsx
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";

<html className={`${GeistSans.variable} ${GeistMono.variable}`}>
```

### 3. Styles

**Full import** (tokens + component classes):
```css
@import "@flink-reactor/ui/styles";
```

**Selective imports**:
```css
@import "@flink-reactor/ui/styles/tokens";     /* color tokens, fonts, spacing */
@import "@flink-reactor/ui/styles/components";  /* .glass-card, .log-line, etc. */
```

### 4. Tailwind CSS v4

```js
// postcss.config.mjs
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```

### 5. Router Integration

Layout components are router-agnostic. Pass your router's Link component:

```tsx
import Link from "next/link"; // or your router's Link
import { Sidebar } from "@flink-reactor/ui";

<Sidebar
  navGroups={[...]}
  LinkComponent={Link}
  activePath={pathname}
/>
```

<br />

## Development

```bash
pnpm build       # Build the package
pnpm dev         # Watch mode
pnpm typecheck   # Type-check
```

### Monorepo usage

```bash
pnpm add @flink-reactor/ui@workspace:*
```

The reference implementation lives in [`apps/dashboard/`](../../apps/dashboard), which uses all layout and shared components with Zustand state management.

<br />

## License

[MIT](./LICENSE)
