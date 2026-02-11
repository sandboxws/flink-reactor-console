---
globs: src/components/**
---

# Component Conventions

## Page Delegation

Each `page.tsx` is a thin wrapper that delegates to a single top-level component:
- `overview/page.tsx` → `overview-page.tsx`
- `jobs/[id]/page.tsx` → `job-detail.tsx`
- etc.

All page components are client components (`"use client"`).

## Directory Organization

Domain-specific subdirectories mirror routes:
- `layout/` — Shell, Header, Sidebar, CommandPalette
- `overview/` — StatCard, SlotUtilization, JobStatusSummary, JobList
- `jobs/` — JobsTable, JobStatusBadge, TaskCountsBar, DurationCell
- `jobs/detail/` — JobGraph, OperatorNode, StrategyEdge, and 7 tab components
- `task-managers/` — TaskManagerList, MemoryBar, TM tab components
- `job-manager/` — JM tab components (config, metrics, logs, stdout, classpath, JVM, threads, profiler)
- `logs/` — LogExplorer, LogList, LogToolbar, LogDetailPanel, LogHistogram
- `errors/` — ErrorExplorer, ErrorGroupList, StackTrace
- `shared/` — Reusable: MetricCard, EmptyState, SearchInput, TextViewer, ThreadDumpViewer, SeverityBadge, SourceBadge
- `ui/` — Shadcn primitives only. **Never** create custom components in `ui/`.

## Styling Rules

- Use `cn()` from `@/lib/cn` for className merging (clsx + twMerge)
- Icons from `lucide-react` exclusively
- Floating surfaces (SelectContent, HoverCardContent, PopoverContent): always `bg-dash-panel border-dash-border` — never `bg-dash-elevated`
- Surface layer order (darkest → lightest): `bg-fr-bg` → `bg-dash-surface` → `bg-dash-panel` → `bg-dash-elevated`
- Glass cards: use the `.glass-card` CSS class for frosted-glass effect
- Job status colors: use `--color-job-running/finished/cancelled/failed` tokens
- Log severity: use `--color-log-trace/debug/info/warn/error` tokens

## Store Access

- Import stores directly: `import { useClusterStore } from "@/stores/cluster-store"`
- Components read store state with selectors: `const overview = useClusterStore((s) => s.overview)`
- Side effects (polling, fetching) happen in stores, not components
