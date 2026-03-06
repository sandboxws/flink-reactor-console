# FlinkReactor Dashboard

Real-time Apache Flink cluster monitoring dashboard.

## Plan Mode → OpenSpec Change

When entering plan mode for adding or modifying dashboard features, **do not** write a default plan file. Instead:

1. Read `openspec/AGENTS.md` for the full openspec workflow
2. Run `openspec list` to check for conflicts with active changes
3. Choose a verb-led change ID (e.g., `add-dashboard-<feature>`, `update-dashboard-<feature>`)
4. Scaffold a full openspec change under `openspec/changes/<change-id>/`:
   - **`proposal.md`** — Why, what changes, impact (affected specs, files)
   - **`design.md`** — Always create this. Include context, goals/non-goals, decisions with rationale, file map, component interfaces, existing patterns to follow, risks/trade-offs
   - **`tasks.md`** — Implementation checklist with subtasks
   - **`specs/<capability>/spec.md`** — Delta specs (ADDED/MODIFIED/REMOVED requirements with scenarios)
5. Run `openspec validate <change-id> --strict` to verify
6. Present the proposal for approval via ExitPlanMode

The `design.md` is mandatory for every dashboard change — it serves as the implementation blueprint for the coding session. See the root `CLAUDE.md` for the full `design.md` template.

## Architecture

- **Framework**: Next.js 15 App Router (React 19, `output: standalone`)
- **State**: Zustand 5 stores (no Redux, no React Context for state)
- **Styling**: Tailwind CSS v4 + Tokyo Night color palette (dark-only)
- **Charts**: Recharts 2 (time-series), @xyflow/react 12 (DAG visualization)
- **Icons**: `lucide-react` exclusively
- **Utilities**: `cn()` from `@/lib/cn`, `date-fns` for formatting

## Configuration Resolution

The dashboard's config can come from two sources, with this merge priority:

```
Explicit env var  →  highest (e.g., FLINK_REST_URL overrides JSON)
       ↓
FLINK_REACTOR_CONFIG JSON  →  resolved by CLI
       ↓
Built-in defaults  →  dashboard defaults
```

**Resolution flow (dev mode):**
```
flink-reactor dev --env development
  → resolveConfig() merges common + environment, resolves env() markers
  → buildResolvedDashboardJson() → flat JSON shape
  → writes .flink-reactor/resolved-dashboard.json
  → spawns dashboard with FLINK_REACTOR_CONFIG=/path/to/json
```

**Resolution flow (production):**
```
flink-reactor dashboard export --env production -o dist/dashboard-config.json
  → bake JSON into Docker image
  → ENV FLINK_REACTOR_CONFIG=/app/dashboard-config.json
```

The `getConfig()` function in `src/lib/config.ts` checks `FLINK_REACTOR_CONFIG` first, falls back to env vars. Explicit env vars always override JSON values for production flexibility.

## Data Flow

```
Flink JobManager REST API
  ↓ (server-side, auth headers)
Go backend (apps/server) — GraphQL API
  ↓ (GraphQL)
urql client → graphql-api-client.ts → domain types
  ↓
Zustand stores → React components
```

**Why Go backend**: Flink REST has no CORS headers. The Go backend aggregates multiple Flink endpoints into single GraphQL queries, injects auth headers server-side, and serves the dashboard as a static export in production.

## File Map

```
src/
├── app/
│   ├── api/
│   │   ├── config/route.ts           # Public config subset
│   │   └── flink/
│   │       ├── overview/route.ts     # GET /overview proxy
│   │       ├── jobs/overview/route.ts # GET /jobs/overview proxy
│   │       └── jobs/[jobId]/detail/route.ts  # Aggregates 8+ Flink endpoints
│   ├── overview/page.tsx             # Cluster overview (stats, slots, job summaries)
│   ├── jobs/running/page.tsx         # Running jobs table
│   ├── jobs/completed/page.tsx       # Completed jobs table
│   ├── jobs/[id]/page.tsx            # Job detail (DAG + 7-tab interface)
│   ├── task-managers/page.tsx        # Task manager list
│   ├── task-managers/[id]/page.tsx   # TM detail (logs, metrics, stdout)
│   ├── job-manager/page.tsx          # JM detail (8-tab interface)
│   ├── logs/page.tsx                 # Real-time log explorer
│   ├── errors/page.tsx               # Exception aggregator
│   ├── layout.tsx                    # Root layout with Shell
│   └── global.css                    # Theme tokens + utility classes
├── components/
│   ├── layout/                       # Shell, Header, Sidebar, CommandPalette
│   ├── overview/                     # StatCard, SlotUtilization, JobStatusSummary, JobList
│   ├── jobs/                         # JobsTable, JobStatusBadge, TaskCountsBar
│   ├── jobs/detail/                  # JobGraph, OperatorNode, StrategyEdge, 7 tab components
│   ├── task-managers/                # TaskManagerList, MemoryBar, TM tabs
│   ├── job-manager/                  # JM tabs (config, metrics, logs, stdout, classpath, JVM, threads, profiler)
│   ├── logs/                         # LogExplorer, LogList, LogToolbar, LogDetailPanel, LogHistogram
│   ├── errors/                       # ErrorExplorer, ErrorGroupList, StackTrace
│   ├── shared/                       # MetricCard, EmptyState, SearchInput, TextViewer, ThreadDumpViewer
│   └── ui/                           # Shadcn primitives only — never create custom UI components here
├── stores/
│   ├── cluster-store.ts              # Overview, jobs, TMs, JM, polling, job detail fetch
│   ├── config-store.ts               # Runtime config from GraphQL dashboardConfig (cached singleton)
│   ├── log-store.ts                  # Log buffer (FIFO at 100k), streaming toggle, speed
│   ├── filter-store.ts               # Severity, search (literal/regex), source, time range
│   ├── error-store.ts                # Exception groups (class + message prefix key), sort
│   └── ui-store.ts                   # Sidebar collapse, detail panel, command palette, timestamp format
├── data/
│   ├── flink-api-types.ts            # Raw Flink REST response shapes (hyphenated keys)
│   ├── cluster-types.ts              # Domain types (camelCase)
│   ├── flink-api-mappers.ts          # Pure functions: raw → domain (state collapse, metrics conversion)
│   ├── types.ts                      # Log/error domain types
│   ├── log-parser.ts                 # Raw log line → structured LogEntry
│   ├── thread-dump-parser.ts         # Java thread dump → ThreadDumpEntry[]
│   └── flink-loggers.ts              # Logger name → Flink component mapping
├── lib/
│   ├── config.ts                     # DashboardConfig from env vars (server), PublicDashboardConfig (browser)
│   ├── flink-api-client.ts           # Browser-side: fetch proxy routes → apply mappers
│   ├── flink-fetcher.ts              # Server-side: auth headers, timeouts, proxy to Flink REST
│   ├── hooks.ts                      # useFilteredLogs, useSearchMatches (debounced 300ms), useAutoScroll
│   ├── constants.ts                  # Color maps, buffer limits, timestamp formats
│   └── cn.ts                         # clsx + twMerge shorthand
└── cli.ts                            # Commander.js CLI: start command (Next.js standalone server)
```

## Styling Conventions

- **Theme**: Tokyo Night palette, dark-only. Tokens defined in `global.css` `@theme` block.
- **Surface layers** (darkest → lightest): `bg-fr-bg` → `bg-dash-surface` → `bg-dash-panel` → `bg-dash-elevated`
- **Floating surfaces** (Select, HoverCard, Popover): always `bg-dash-panel border-dash-border` — never `bg-dash-elevated`
- **Glass cards**: `.glass-card` class for frosted-glass effect with hover glow
- **Job status colors**: `--color-job-running` (teal), `--color-job-finished` (blue), `--color-job-cancelled` (amber), `--color-job-failed` (coral)
- **Log severity colors**: `--color-log-trace/debug/info/warn/error` (Tokyo Night)
- **Brand accent**: `--color-fr-coral` (primary), `--color-fr-purple` (secondary), `--color-fr-amber` (tertiary)

## State Management Pattern

All stores use `create<T>()` from Zustand. Key patterns:
- `cluster-store` has an `initialize()` guard (runs once) + `startPolling()`/`stopPolling()` (5s default)
- Polling fetches `/api/flink/overview` + `/api/flink/jobs/overview` in parallel
- On error: stale data stays visible, only `fetchError` is set (no data clearing)
- Job detail is lazy-loaded via `fetchJobDetail(jobId)` into separate `jobDetail` state
- Config store fetches once from `/api/config`, caches result (no re-fetch)

## Mock Mode

Mock mode has been removed from the dashboard. The Go backend (`apps/server`) handles all Flink communication and has its own mock data (`mock_data.go`) when no Flink cluster is connected. The dashboard always operates in live mode, fetching data from the Go backend's GraphQL API.

## Component Conventions

- Pages are thin: `page.tsx` delegates to a single top-level component
- Domain subdirectories: `overview/`, `jobs/`, `jobs/detail/`, `task-managers/`, `job-manager/`, `logs/`, `errors/`
- Shared components in `shared/` (MetricCard, EmptyState, TextViewer, SearchInput, etc.)
- All components are client components (`"use client"`)
- Use `cn()` from `@/lib/cn` for className merging

## Keeping Docs Current

When a change adds/removes pages, components, stores, API routes, or data layer files, update the relevant docs in the same session:
- **New page/component/store** → update the File Map above and the relevant `.claude/rules/` file
- **New Flink endpoint** → update `FLINK_REST_API.md`
- **Convention change** → update the relevant section here or in `.claude/rules/`

## Flink REST API Reference

For endpoint catalog, state enums, API quirks, and the two-phase fetch pattern, see @FLINK_REST_API.md
