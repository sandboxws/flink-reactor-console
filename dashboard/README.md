# @flink-reactor/dashboard

Real-time monitoring dashboard for Apache Flink clusters. Built with Next.js 16, React 19, and Zustand — designed for dark environments with a Tokyo Night color palette and glassmorphism UI.

## Overview

The Flink Reactor Dashboard gives you a single pane of glass into your Flink cluster: job health, task manager resources, live logs, exception analysis, checkpoints, thread dumps, and execution plan visualization. It ships as an npm package with a built-in CLI so you can run it standalone — no separate infrastructure required.

The dashboard works out of the box with **mock data** for local development and demo purposes. Point it at a real Flink REST API when you're ready to go live.

## Features

### Cluster Overview
- Slot utilization gauge with health-based color coding (green / amber / red)
- Task manager count, total slots, and available slots at a glance
- Job status breakdown: running, finished, cancelled, failed

### Job Management
- **Running & completed job tables** with sortable columns, live duration counters, and visual task-count bars showing running/finished/failed/pending breakdown
- **Job detail view** with 6 tabs:
  - **Execution Graph** — interactive DAG visualization (pan, zoom) showing operators and partition strategies (FORWARD, HASH, BROADCAST, etc.)
  - **Exceptions** — stack traces grouped by task
  - **Data Skew** — per-subtask record distribution bar chart with skew ratio analysis
  - **Timeline** — task execution timeline for bottleneck identification
  - **Checkpoints** — checkpoint history table with sparkline trends for size and duration, savepoint indicators, and config summary
  - **Configuration** — job-level key-value config viewer
- Cancel jobs and create savepoints directly from the UI

### Task Managers
- Sortable table with live heartbeat timestamps, slot allocation, CPU cores, and four memory categories (physical, JVM heap, managed, network) rendered as usage bars
- Per-TM detail view with metrics charts, logs, and stdout tabs

### Job Manager
- 7-tab detail view: Configuration, Metrics (JVM heap/non-heap/threads/GC time-series), Logs, Stdout, Log File browser, Thread Dump viewer, and Profiler
- Thread dump visualizer with state distribution bar (RUNNABLE / WAITING / BLOCKED), collapsible stack frames, framework-frame folding, and copy-to-clipboard
- JVM memory breakdown (heap, non-heap, metaspace, direct) and classpath inspector

### Log Explorer
- Streams up to **100,000 log entries** with virtual scrolling for smooth performance
- Histogram showing log distribution over time
- Filter by severity (TRACE / DEBUG / INFO / WARN / ERROR), source (TaskManager / JobManager / Client), time range, and text search with regex support
- Resizable detail panel with full stack trace view
- Auto-scroll that pauses when you scroll up and resumes on new entries

### Error Analysis
- Automatic exception grouping by class and message prefix
- Master-detail layout with occurrence timeline chart
- Tracks affected sources and first/last seen timestamps

### Navigation & UX
- **Command palette** (Cmd+K / Ctrl+K) for quick navigation to any page
- Collapsible sidebar organized into Cluster, Jobs, Cluster Management, Diagnostics, and Operations groups
- Configurable timestamp formats (full / time / short)
- Copy-to-clipboard on job IDs and task manager IDs with visual feedback

## Installation

### As an npm package

```bash
npm install @flink-reactor/dashboard
```

Then start the dashboard:

```bash
npx flink-reactor-dashboard start
```

### From source (development)

```bash
git clone https://github.com/your-org/flink-reactor.git
cd flink-reactor
pnpm install
pnpm --filter @flink-reactor/dashboard dev
```

The dashboard starts at [http://localhost:3001](http://localhost:3001) with mock data — no Flink cluster needed.

## CLI Usage

```
flink-reactor-dashboard start [options]

Options:
  -p, --port <port>     Dashboard port (default: 3001)
  -e, --env <name>      Environment: development | staging | production (default: production)
  -c, --config <path>   Custom .env file path (overrides --env)
  --mock                Force mock mode (ignore FLINK_REST_URL)
  -V, --version         Output the version number
  -h, --help            Display help
```

### Examples

```bash
# Start with mock data on port 3002
flink-reactor-dashboard start --mock --port 3002

# Start with staging environment config
flink-reactor-dashboard start --env staging

# Start with a custom env file
flink-reactor-dashboard start --config /etc/flink-dashboard/.env
```

## Configuration

Configuration is read from environment variables. Copy `.env.example` to `.env` and adjust:

```bash
cp .env.example .env
```

Per-environment templates are also included: `.env.development`, `.env.staging`, `.env.production`.

### Core Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `FLINK_REST_URL` | _(none)_ | Flink cluster REST API URL. Unset = mock mode |
| `DASHBOARD_PORT` | `3001` | Dashboard server port |
| `DASHBOARD_MOCK_MODE` | `auto` | `auto` / `on` / `off`. Auto enables mock when no Flink URL is set |
| `DASHBOARD_POLL_INTERVAL` | `5000` | Polling interval in milliseconds |
| `DASHBOARD_LOG_BUFFER_SIZE` | `100000` | Max log entries held in memory |
| `CLUSTER_DISPLAY_NAME` | `Default Cluster` | Display name shown in the header |

### Authentication

| Variable | Default | Description |
|----------|---------|-------------|
| `FLINK_AUTH_TYPE` | `none` | `none` / `basic` / `token` |
| `FLINK_AUTH_USERNAME` | | Required when `FLINK_AUTH_TYPE=basic` |
| `FLINK_AUTH_PASSWORD` | | Required when `FLINK_AUTH_TYPE=basic` |
| `FLINK_AUTH_TOKEN` | | Required when `FLINK_AUTH_TYPE=token` |

### SSL, Multi-Cluster, RBAC, Prometheus, and Alerts

See [`.env.example`](.env.example) for the full list of supported variables.

## Scripts

| Script | Description |
|--------|-------------|
| `pnpm dev` | Start Next.js dev server on port 3001 |
| `pnpm build` | Production Next.js build with standalone output |
| `pnpm build:cli` | Bundle the CLI entry point with tsup |
| `pnpm build:package` | Full build: Next.js + CLI + standalone preparation |
| `pnpm start` | Start the production Next.js server |
| `pnpm lint` | Run Biome linter |
| `pnpm format` | Auto-format with Biome |

## Tech Stack

- **Next.js 16** — App Router, React Server Components, standalone output
- **React 19** — Concurrent features, Server Components
- **Zustand** — Lightweight state management (5 stores: cluster, logs, errors, filters, UI)
- **Recharts** — Area charts, bar charts, and sparklines for metrics
- **XYFlow** — Interactive DAG graph for job execution plans
- **TanStack Virtual** — Virtualized lists for 100K+ log entries
- **Motion** — Animations and transitions
- **Tailwind CSS 4** — Utility-first styling with custom design tokens
- **Geist** — Monospace and sans-serif font families
- **Biome** — Linting and formatting

## License

MIT
