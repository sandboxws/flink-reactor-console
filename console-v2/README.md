# console-v2

A static HTML re-imagining of the **FlinkReactor Console** — every page of the live dashboard, redrawn in the FR Gruvpuccin visual language and the Linear-quality primitives proven in the gitcore suite.

This is design exploration, not a refactor. None of `dashboard/src/` changes.

---

## Open

```bash
open ~/Development/reactors/flink/flink-reactor-console/console-v2/
```

`index.html` redirects to `overview.html`. No build step. No backend. CDN for Tailwind v3, Geist fonts, lucide icons.

Optimised for **1440 × 900**. At 1280px, right rails collapse; sidebar stays.

### One exception: the ReactFlow DAG on `job.html`

ReactFlow is ESM-only and modern browsers refuse to fetch ES modules over `file://` (CORS). To see the interactive DAG:

```bash
cd ~/Development/reactors/flink/flink-reactor-console/console-v2
python3 -m http.server 8000
# then open http://localhost:8000/job.html
```

Opening `job.html` directly via `file://` still works — the page falls back to a static SVG and shows an inline notice with the command above. Every other page in the suite renders identically over `file://` and `http://`.

---

## Pages (29)

### Shell
| Page | Purpose |
|------|---------|
| [`index.html`](index.html) | Entry point — redirects to overview |
| [`404.html`](404.html) | Branded not-found |

### Overview
| Page | Purpose |
|------|---------|
| [`overview.html`](overview.html) | KPI hero · engine bars · top pipelines · activity · instrument health · checkpoint heatmap |

### Jobs
| Page | Purpose |
|------|---------|
| [`jobs-running.html`](jobs-running.html) | Running pipelines list, status pills, parallelism, throughput |
| [`jobs-completed.html`](jobs-completed.html) | Completed jobs with time-range filter |
| [`jobs-submit.html`](jobs-submit.html) | JAR uploader form with validation rail |
| [`job.html`](job.html) | **Signature** — DAG, sub-tabs, KPIs, recent checkpoints, exceptions |

### Cluster
| Page | Purpose |
|------|---------|
| [`task-managers.html`](task-managers.html) | TM list with resource bars, memory breakdown segments |
| [`task-manager.html`](task-manager.html) | TM detail · memory · GC · hosted pipelines |
| [`job-manager.html`](job-manager.html) | JM detail · 8 tabs · config · quorum |

### Deployments
| Page | Purpose |
|------|---------|
| [`deployments.html`](deployments.html) | **Signature** — Linear-style kanban (Pending → Validating → Live → Rolling back → Complete) |
| [`deployment.html`](deployment.html) | Blue/green vs cards · traffic shift · config diff (background-tint only) · state machine |

### Observability
| Page | Purpose |
|------|---------|
| [`health.html`](health.html) | Health rings hero · pipeline rows · resource pressure · instrument health |
| [`metrics.html`](metrics.html) | Query bar · main chart · sparkline grid · metric catalog |
| [`bottlenecks.html`](bottlenecks.html) | Top hot operators · subtask backpressure heatmap · root causes |
| [`alerts.html`](alerts.html) | **Signature** — Linear-styled list (priority bars + status icons + filter chips + grouping) |
| [`checkpoints.html`](checkpoints.html) | KPI strip · engine bars · per-pipeline summary · density heatmap · savepoints |

### Logs / Errors
| Page | Purpose |
|------|---------|
| [`logs.html`](logs.html) | Real-time log explorer · level filter chips · live-streaming · detail panel |
| [`errors.html`](errors.html) | Grouped exception list · stack trace viewer · recurrence sparkbar |

### Data
| Page | Purpose |
|------|---------|
| [`materialized-tables.html`](materialized-tables.html) | MV list with refresh status · view definition · downstream consumers |
| [`catalogs.html`](catalogs.html) | Catalog tree browser (databases → tables) · schema · sample rows |
| [`sql-explorer.html`](sql-explorer.html) | Full-bleed SQL editor · saved queries · result grid · streaming |

### Tools
| Page | Purpose |
|------|---------|
| [`sandbox.html`](sandbox.html) | DSL editor · live plan-graph preview · validation · simulate |
| [`simulations.html`](simulations.html) | Sim runs list · throughput timeline · inferred outcome |

### Instruments
| Page | Purpose |
|------|---------|
| [`instruments.html`](instruments.html) | Grid of instruments · pipeline ⇄ instrument matrix |
| [`instrument-fluss.html`](instrument-fluss.html) | Fluss · TabletServer/Coord/ZK topology · tables list |
| [`instrument-redis.html`](instrument-redis.html) | Redis · primary/replica · memory breakdown · key browser |
| [`instrument-schema-registry.html`](instrument-schema-registry.html) | Subjects · version timeline · **diff viewer for schema versions** |
| [`instrument-database.html`](instrument-database.html) | Federated catalog · backends · query throughput · quick query |

---

## Shared (`shared/`)

| File | Purpose |
|------|---------|
| `styles.css` | All CSS primitives — glass cards, status icons, priority bars, kanban, log-viewer, diff lines (background-tint only), heatmap cells, etc. |
| `tw-config.js` | Tailwind v3 `tailwind.config` extension (FR colors, fonts, max-widths) — loaded **before** the CDN script |
| `icons.js` | lucide loader · brand-glyph injector · sidebar nav highlighter · engine-bars chart · checkpoint heatmap · throughput ticker · demo-data cast |

---

## Design language

### Identity
- **Brand glyph**: 3 concentric coral circles (`#e78a4e`)
- **Wordmark**: `flinkreactor.hub` + `ALPHA` chip
- **Palette**: FR Gruvpuccin — coral, sage, amber, teal, rose, violet on warm earth fg
- **Fonts**: Geist Sans (UI), Geist Mono (data)
- **Surfaces**: Glass cards (`backdrop-filter: blur(12px)` on subtle warm tint)
- **Live touches**: Sage pulse dots on running, throughput jitter every 2.2s, watermark every 2.8s, heatmap renders 26 weeks deterministically

### Borrowed from gitcore (Linear primitives)
- Status icons (firing / acknowledged / in-progress / resolved / suppressed / silenced) via conic-gradient
- Priority bars (5 levels, 3 stacked monospace bars)
- Filter chips, prop-chip bar
- Log viewer (timestamp + level + message grid)
- Kanban columns (status conveyed via column header — never per-card accent)
- Diff lines (background tint only — see hard rule below)
- File-tree rows
- Activity timeline entries
- Faux syntax tinting (`tk-key`, `tk-str`, `tk-fn`, etc.)
- Tab nav (active underline)

### Hard rule: no left-border accents

Status, severity, and active-state are **never** conveyed via a colored vertical left border on cards / rows / list items / diffs. That pattern is overused in dashboards and visually heavy.

Replacements:

| Where left-border would normally appear | Used instead |
|---|---|
| Status accent on a card | Status pill in corner / inline dot / muted background tint |
| Active row in a list/table | Background fill |
| Review threads | Indent + small avatar gutter |
| Diff lines | Background tint + `+`/`-` in gutter only |
| Active step in a workflow | Filled status icon + bolder text |
| Sidebar nav active | Background fill (kept) |

---

## Demo data cast

Consistent across all 29 pages so navigation feels like one cluster.

- **Cluster**: `acme-prod-1.fr` (also `acme-stage-1.fr`, `dev-local`) · Flink 1.20.1 · us-west-2 · 8 TMs · 768 slots · 91% util
- **Pipelines** (the demo Flink jobs):
  - `reactor-core` · running · 4.21M evt/s · 247 tasks
  - `clickstream-enrich` · running · 3.10M evt/s
  - `fluss-ingest` · running · 1.83M evt/s
  - `paimon-sink` · running · 920K evt/s
  - `datalake-connect` · warning · backpressure on `op.4`
  - `schema-registry-sync` · running · 12K evt/s
  - `cdc-loader` · failed · `PSQLException: Connection refused`
- **Instruments**: Fluss ✓ · Paimon ✓ · Redis ✓ · Schema Registry ⚠ (1 incompatible subject) · Datalake ✓
- **Users**: ahmed, kira, liam, mei, nora, omar, priya, quinn

---

## How to verify

1. Open `console-v2/index.html` — top bar + sidebar + main render fully on first paint via CDN.
2. Click any sidebar item — page loads, active nav highlight follows via `body[data-page]` + `icons.js` auto-highlighter.
3. Cross-page navigation: pipeline name on overview → `job.html`; alert title → alert detail (else stays on alerts list); instrument card → `instrument-*.html`.
4. At **1440 × 900** no horizontal overflow; sidebar + main + right rail fit. At 1280px right rail collapses.
5. Brand glyph + wordmark + ALPHA on every header.
6. Live touches: sage pulse on running rows, throughput ticker on overview KPI rail, heatmap renders 26 weeks deterministically.
7. **Side-by-side with `~/Development/github/flink-reactor-hub.html`** — same identity; overview is functional, hub is the marketing pitch.
8. **Side-by-side with `~/Development/reactors/gitcore/board.html`** — kanban primitives identical (proves the shared/ contract works across both suites).

If a primitive looks off (engine bars, heatmap, kanban, diff), edit it in `shared/styles.css` or `shared/icons.js` and the whole suite reflows.

---

## Out of scope

- Real React components — these are static HTML
- Backend / GraphQL integration
- Any contribution to `dashboard/src/`
- Tests, types, codegen
- Mobile responsive (designed for 1440px+, like gitcore)
- A separate marketing/landing page — `index.html` IS the overview redirect
