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

## Data Flow

```
Flink JobManager REST API
  ↓ (server-side, auth headers)
/api/flink/* proxy routes (src/app/api/flink/)
  ↓ (JSON)
Browser fetch → flink-api-client.ts → mappers (flink-api-mappers.ts)
  ↓ (domain types)
Zustand stores → React components
```

**Why proxy routes**: Flink REST has no CORS headers. Proxy routes also aggregate multiple endpoints (e.g., job detail hits 8+ Flink endpoints in one browser request) and inject auth headers server-side.

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
│   ├── config-store.ts               # Runtime config from /api/config (cached singleton)
│   ├── log-store.ts                  # Log buffer (FIFO at 100k), streaming toggle, speed
│   ├── filter-store.ts               # Severity, search (literal/regex), source, time range
│   ├── error-store.ts                # Exception groups (class + message prefix key), sort
│   └── ui-store.ts                   # Sidebar collapse, detail panel, command palette, timestamp format
├── data/
│   ├── flink-api-types.ts            # Raw Flink REST response shapes (hyphenated keys)
│   ├── cluster-types.ts              # Domain types (camelCase)
│   ├── flink-api-mappers.ts          # Pure functions: raw → domain (state collapse, metrics conversion)
│   ├── types.ts                      # Log/error domain types
│   ├── mock-cluster.ts               # Mock factories for TM, JM, overview
│   ├── mock-api-responses.ts         # Mock Flink API response generators
│   ├── mock-generator.ts             # Real-time log entry generator
│   ├── mock-errors.ts                # Mock exception entries
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

- Auto-enabled when `FLINK_REST_URL` is not set (configurable via `DASHBOARD_MOCK_MODE=on|off|auto`)
- API routes return data from `mock-api-responses.ts` / `mock-cluster.ts`
- Log streaming uses `mock-generator.ts` (50-500 entries/sec)
- TM/JM metrics refresh locally (not API-backed yet)
- Mock data is indistinguishable from real Flink responses

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
