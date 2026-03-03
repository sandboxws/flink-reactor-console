# Flink REST API Endpoint Coverage Analysis

> Generated 2026-02-26. Compares Flink Web UI (Angular) endpoints against FlinkReactor Dashboard implementation.

## Summary

| Category | Flink Web UI | Our Dashboard | Coverage |
|----------|-------------|---------------|----------|
| Cluster Config/Status | 2 endpoints | 1 (`/api/config`) | Partial — missing `/config` |
| Cluster Overview | 1 endpoint | 1 (live) | **Full** |
| Job List | 1 endpoint | 1 (live) | **Full** |
| Job Detail | 2 endpoints | 1 aggregate (live) | **Full** |
| Job Configuration | 1 endpoint | Aggregated into detail (live) | **Full** |
| Job Exceptions | 1 endpoint | Aggregated into detail (live) | **Full** |
| Job Cancellation | 1 endpoint (GET `/yarn-cancel`) | Mock only | **Gap** |
| Job Checkpoints | 4 endpoints | 2 aggregated (live), 2 missing | Partial |
| Job Vertices/Subtasks | 2 endpoints | 1 aggregated (live) | Partial |
| Job Vertex Metrics | 3 endpoints | 0 | **Gap** |
| Job Vertex Flamegraph | 2 endpoints | 0 | **Gap** |
| Job Vertex Watermarks | 1 endpoint | 1 aggregated (live) | **Full** |
| Job Vertex Backpressure | 1 endpoint | 1 aggregated (live) | **Full** |
| Job Vertex Accumulators | 2 endpoints | 1 aggregated (live) | Partial |
| Job Vertex TaskManagers | 1 endpoint | 0 | **Gap** |
| Job Vertex Timeline | 1 endpoint | 0 | **Gap** |
| Job Resource Requirements | 2 endpoints (GET+PUT) | 0 | **Gap** |
| JAR Management | 5 endpoints | 0 (mock only) | **Gap** |
| JobManager | 12 endpoints | 0 (mock only) | **Gap** |
| TaskManagers | 12 endpoints | 0 (mock only) | **Gap** |
| History Server | 4 endpoints | 0 | **Gap** (N/A for v1) |
| Application Mode | 3 endpoints | 0 | **Gap** (N/A for v1) |
| **Total** | **~60 endpoints** | **11 live** | **~18%** |

---

## I. Endpoints We Fully Cover (Live API)

These endpoints are proxied through our API routes and connected to real Flink REST.

### Cluster Overview
| Flink Endpoint | Our Route | Mapper | Status |
|---|---|---|---|
| `GET /overview` | `GET /api/flink/overview` | `mapOverviewResponse()` | **Live** |

**Fields mapped**: `flink-version`→`flinkVersion`, `flink-commit`→`flinkCommitId`, `slots-total`→`totalTaskSlots`, `slots-available`→`availableTaskSlots`, `jobs-running/finished/cancelled/failed`→camelCase, `taskmanagers`→`taskManagerCount`

**Fields we DROP** (Flink has, we don't map):
- `slots-free-and-blocked` (optional, blocked slots)
- `taskmanagers-blocked` (optional, blocked TMs)

### Job List
| Flink Endpoint | Our Route | Mapper | Status |
|---|---|---|---|
| `GET /jobs/overview` | `GET /api/flink/jobs/overview` | `mapJobsOverviewResponse()` | **Live** |

**Fields mapped**: `jid`→`id`, `name`, `state`→`status`, `start-time`→`startTime`, `end-time`→`endTime`, `duration`, `tasks`→collapsed to 5 states

**Fields we DROP**:
- `last-modification` (timestamp of last state change)
- `pending-operators` (optional, for reactive mode)
- Individual task states: We collapse 12→5 (losing `DEPLOYING`, `SCHEDULED`, `RECONCILING`, `INITIALIZING` as individual states — they go into `pending`)

### Job Detail (Aggregated)
| Flink Endpoint | Our Route | Mapper | Status |
|---|---|---|---|
| `GET /jobs/:jid` | `GET /api/flink/jobs/[jobId]/detail` | `mapJobPlan()`, `mapJobDetailVertices()` | **Live** |
| `GET /jobs/:jid/exceptions` | (aggregated) | `mapExceptions()` | **Live** |
| `GET /jobs/:jid/checkpoints` | (aggregated) | `mapCheckpoints()` | **Live** |
| `GET /jobs/:jid/checkpoints/config` | (aggregated) | `mapCheckpointConfig()` | **Live** |
| `GET /jobs/:jid/config` | (aggregated) | `mapJobConfiguration()` | **Live** |
| `GET /jobs/:jid/vertices/:vid` | (aggregated, per vertex) | `mapSubtaskMetrics()` | **Live** |
| `GET /jobs/:jid/vertices/:vid/watermarks` | (aggregated, per vertex) | `mapWatermarks()` | **Live** |
| `GET /jobs/:jid/vertices/:vid/backpressure` | (aggregated, per vertex) | `mapBackPressure()` | **Live** |
| `GET /jobs/:jid/vertices/:vid/accumulators` | (aggregated, per vertex) | `mapAccumulators()` | **Live** |

**Fields we DROP from `GET /jobs/:jid`**:
- `isStoppable` (whether job can be stopped with savepoint)
- `now` (server timestamp)
- `timestamps` (map of state→timestamp for all state transitions)
- `status-counts` (pre-aggregated task status counts)

**Fields we DROP from exceptions**:
- `root-exception` (legacy single exception string)
- `truncated` (whether exception list was truncated)
- `all-exceptions` (legacy format, parallel to `exceptionHistory`)
- `failureLabels` (classifier labels on exceptions)
- `concurrentExceptions` (exceptions that happened simultaneously)
- `taskManagerId` / `endpoint` (we have `taskName` and `location` but not TM ID)

**Fields we DROP from checkpoints**:
- `counts` (restored/total/in_progress/completed/failed counts)
- `summary` (percentile stats: min/max/avg/p50/p90/p95/p99/p999 for size/duration/data)
- `latest` (latest completed/savepoint/failed/restored checkpoints)
- `savepointFormat` (checkpoint detail field)
- `num_subtasks` / `num_acknowledged_subtasks` (per-checkpoint)
- `tasks` map in checkpoint detail (per-vertex checkpoint stats)

**Fields we DROP from checkpoint config**:
- `externalization` (`enabled`, `delete_on_cancellation`)
- `state_backend` name
- `checkpoint_storage` name
- `unaligned_checkpoints` (boolean)
- `tolerable_failed_checkpoints` (number)

**Fields we DROP from vertex detail**:
- `aggregated` statistics (read/write bytes/records aggregates)
- `status-duration` per subtask
- `host` per subtask (we have `endpoint` but not the host breakdown)

---

## II. Endpoints Partially Covered

### Checkpoint Detail Drill-Down
| Flink Endpoint | Status | Gap |
|---|---|---|
| `GET /jobs/:jid/checkpoints/details/:cpid` | **Missing** | Individual checkpoint detail with per-vertex task breakdown |
| `GET /jobs/:jid/checkpoints/details/:cpid/subtasks/:vid` | **Missing** | Per-subtask checkpoint stats with percentile summary |

We fetch checkpoint history via `/jobs/:jid/checkpoints` but don't support drilling into individual checkpoint details or subtask-level checkpoint data.

### Vertex Subtask Accumulators
| Flink Endpoint | Status | Gap |
|---|---|---|
| `GET /jobs/:jid/vertices/:vid/subtasks/accumulators` | **Missing** | Per-subtask accumulator breakdown (name/type/value per subtask) |

We fetch vertex-level accumulators but miss the per-subtask breakdown.

---

## III. Endpoints We're Missing Entirely

### A. Job-Level Gaps

#### Job Cancellation
| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jobs/:jid/yarn-cancel` | GET | Cancel a running job |

**Impact**: Users can't cancel jobs from our dashboard. The Flink UI also gates this behind `features['web-cancel']` from `/config`.

#### Vertex Metrics (Time-Series Charts)
| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jobs/:jid/vertices/:vid/metrics` | GET | List all available metric names for a vertex |
| `GET /jobs/:jid/vertices/:vid/metrics?get=name1,name2` | GET | Fetch specific metric values (for charting) |
| `GET /jobs/:jid/vertices/:vid/subtasks/metrics?get=name1,name2` | GET | Aggregated subtask metrics with min/max/avg/sum/skew |

**Impact**: No custom metric charting per vertex. The Flink UI has a "Metrics" drawer tab that lets users pick any available metric and plot it over time. Also used for data skew detection (the `skew` aggregate).

#### Flamegraph (CPU/Thread Profiling)
| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jobs/:jid/vertices/:vid/flamegraph?type=on_cpu` | GET | CPU flame graph for all subtasks |
| `GET /jobs/:jid/vertices/:vid/flamegraph?type=off_cpu` | GET | Off-CPU flame graph |
| `GET /jobs/:jid/vertices/:vid/flamegraph?type=full` | GET | Full (mixed) flame graph |
| `GET /jobs/:jid/vertices/:vid/flamegraph?type=...&subtaskindex=N` | GET | Single-subtask flame graph |

**Impact**: No inline flame graph visualization. This is a powerful debugging feature in the Flink UI. Gated behind `features['web-profiler']` from `/config`.

#### Vertex Timeline (Subtask Gantt Chart)
| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jobs/:jid/vertices/:vid/subtasktimes` | GET | Per-subtask timing with state transition timestamps |

**Impact**: No subtask-level Gantt chart showing CREATED→RUNNING→FINISHED transitions per subtask.

#### Vertex TaskManagers
| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jobs/:jid/vertices/:vid/taskmanagers` | GET | Which TMs run which subtasks, with per-TM metrics |

**Impact**: No visibility into TM-to-vertex mapping from the job detail view.

#### Resource Requirements (Reactive/Rescale)
| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jobs/:jid/resource-requirements` | GET | Current parallelism bounds per vertex |
| `PUT /jobs/:jid/resource-requirements` | PUT | Change desired parallelism (rescale) |

**Impact**: No support for Flink's reactive mode / adaptive scheduler rescaling. Gated behind `features['web-rescale']`.

### B. Flink Cluster Config

| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /config` | GET | Flink cluster configuration: refresh interval, timezone, version, **feature flags** |

**Feature flags from `/config`**:
- `web-submit` — whether JAR submission UI is enabled
- `web-cancel` — whether job cancellation is enabled
- `web-rescale` — whether rescaling is enabled
- `web-history` — whether running in history server mode
- `web-profiler` — whether profiling/flamegraph is enabled

**Impact**: We can't conditionally show/hide features based on cluster configuration.

### C. JAR Management / Job Submission

| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jars` | GET | List uploaded JARs with entry points |
| `POST /jars/upload` | POST | Upload JAR (multipart form, with progress) |
| `DELETE /jars/:jarId` | DELETE | Delete uploaded JAR |
| `POST /jars/:jarId/run` | POST | Submit job from JAR |
| `GET /jars/:jarId/plan` | GET | Preview execution plan before submitting |

**Impact**: No JAR upload/submit workflow. This is the "Submit New Job" page in Flink UI.

### D. JobManager (All Mock)

| Flink Endpoint | Method | Purpose | Response Type |
|---|---|---|---|
| `GET /jobmanager/config` | GET | JM configuration key-value pairs | `{key, value}[]` |
| `GET /jobmanager/environment` | GET | JVM version, arch, options, classpath | `EnvironmentInfo` |
| `GET /jobmanager/log` | GET | Main JM log file content | `string` (text) |
| `GET /jobmanager/stdout` | GET | JM stdout content | `string` (text) |
| `GET /jobmanager/logs` | GET | List of available JM log files | `{name, size, mtime}[]` |
| `GET /jobmanager/logs/:logName` | GET | Specific log file content | `{data, url}` |
| `GET /jobmanager/thread-dump` | GET | JM thread dump | `{threadInfos: [{threadName, stringifiedThreadInfo}]}` |
| `GET /jobmanager/metrics` | GET | List available JM metric names | `{id}[]` |
| `GET /jobmanager/metrics?get=...` | GET | Fetch specific JM metric values | `{id, value}[]` |
| `GET /jobmanager/profiler` | GET | List profiling instances | `{profilingList: ProfilingDetail[]}` |
| `POST /jobmanager/profiler` | POST | Start profiling session | `ProfilingDetail` |
| `GET /jobmanager/profiler/:file` | GET | Download profiling result | `string` (text) |

**Impact**: Our JM page exists with mock data (`generateJobManagerInfo()`) but none of these are wired to real API.

### E. TaskManagers (All Mock)

| Flink Endpoint | Method | Purpose | Response Type |
|---|---|---|---|
| `GET /taskmanagers` | GET | List all TMs with resources | `{taskmanagers: TaskManagersItem[]}` |
| `GET /taskmanagers/:tmid` | GET | TM detail (hardware, memory config, slots, metrics) | `TaskManagerDetail` |
| `GET /taskmanagers/:tmid/metrics?get=...` | GET | TM metrics (heap, netty, managed memory) | `{id, value}[]` |
| `GET /taskmanagers/:tmid/log` | GET | Main TM log file | `string` (text) |
| `GET /taskmanagers/:tmid/stdout` | GET | TM stdout | `string` (text) |
| `GET /taskmanagers/:tmid/logs` | GET | List TM log files | `{logs: [{name, size, mtime}]}` |
| `GET /taskmanagers/:tmid/logs/:logName` | GET | Specific TM log file | `{data, url}` |
| `GET /taskmanagers/:tmid/thread-dump` | GET | TM thread dump | `{threadInfos: [...]}` |
| `GET /taskmanagers/:tmid/profiler` | GET | List TM profiling instances | `ProfilingList` |
| `POST /taskmanagers/:tmid/profiler` | POST | Start TM profiling | `ProfilingDetail` |
| `GET /taskmanagers/:tmid/profiler/:file` | GET | Download TM profiling result | `string` (text) |

**Key response fields for `GET /taskmanagers/:tmid`**:
- `hardware`: `cpuCores`, `physicalMemory`, `freeMemory`, `managedMemory`
- `memoryConfiguration`: `frameworkHeap`, `frameworkOffHeap`, `taskHeap`, `taskOffHeap`, `networkMemory`, `managedMemory`, `jvmMetaspace`, `jvmOverhead`, `totalFlinkMemory`, `totalProcessMemory`
- `metrics`: `heapUsed/Committed/Max`, `nonHeapUsed/Committed/Max`, `directCount/Used/Max`, `mappedCount/Used/Max`, `memorySegmentsAvailable/Total`, `garbageCollectors[]`
- `allocatedSlots[]`

**Impact**: Our TM list and detail pages exist with mock data but aren't wired to real API.

### F. History Server (Not Applicable for v1)

| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /jobs/:jid/jobmanager/config` | GET | JM config for archived job |
| `GET /jobs/:jid/jobmanager/environment` | GET | JM environment for archived job |
| `GET /jobs/:jid/jobmanager/log-url` | GET | External log URL for completed job |
| `GET /jobs/:jid/taskmanagers/:tmid/log-url` | GET | External TM log URL for archived job |

**Impact**: None for v1. History server support is a separate feature.

### G. Application Mode (Not Applicable for v1)

| Flink Endpoint | Method | Purpose |
|---|---|---|
| `GET /applications/overview` | GET | List applications with job counts |
| `GET /applications/:appId` | GET | Application detail with embedded jobs |
| `POST /applications/:appId/cancel` | POST | Cancel application |

**Impact**: None for v1. Application mode has a different navigation model (applications contain jobs).

---

## IV. Fields We Map vs Fields Flink UI Uses

### `/overview` Response
| Field | Flink UI | Our Dashboard | Gap? |
|---|---|---|---|
| `flink-version` | ✅ | ✅ (`flinkVersion`) | No |
| `flink-commit` | ✅ | ✅ (`flinkCommitId`) | No |
| `taskmanagers` | ✅ | ✅ (`taskManagerCount`) | No |
| `slots-total` | ✅ | ✅ (`totalTaskSlots`) | No |
| `slots-available` | ✅ | ✅ (`availableTaskSlots`) | No |
| `slots-free-and-blocked` | ✅ (optional) | ❌ | Yes — blocked slot visibility |
| `taskmanagers-blocked` | ✅ (optional) | ❌ | Yes — blocked TM count |
| `jobs-running` | ✅ | ✅ (`runningJobs`) | No |
| `jobs-finished` | ✅ | ✅ (`finishedJobs`) | No |
| `jobs-cancelled` | ✅ | ✅ (`cancelledJobs`) | No |
| `jobs-failed` | ✅ | ✅ (`failedJobs`) | No |

### `/jobs/overview` Per-Job Fields
| Field | Flink UI | Our Dashboard | Gap? |
|---|---|---|---|
| `jid` | ✅ | ✅ (`id`) | No |
| `name` | ✅ | ✅ | No |
| `state` | ✅ | ✅ (`status`) | No |
| `start-time` | ✅ | ✅ (`startTime`) | No |
| `end-time` | ✅ | ✅ (`endTime`, -1→null) | No |
| `duration` | ✅ | ✅ | No |
| `last-modification` | ✅ | ❌ | Yes |
| `tasks` (12 states) | ✅ (UPPERCASE) | ✅ (collapsed to 5) | Lossy — we lose individual intermediate states |
| `pending-operators` | ✅ (optional) | ❌ | Yes — reactive mode |

### `/jobs/:jid` Job Detail Fields
| Field | Flink UI | Our Dashboard | Gap? |
|---|---|---|---|
| `jid` | ✅ | ✅ (`id`) | No |
| `name` | ✅ | ✅ | No |
| `state` | ✅ | ✅ (`status`) | No |
| `isStoppable` | ✅ | ❌ | Yes — can't show "stop with savepoint" |
| `start-time` | ✅ | ✅ | No |
| `end-time` | ✅ | ✅ | No |
| `duration` | ✅ | ✅ | No |
| `now` | ✅ | ❌ | Yes — server timestamp for duration calc |
| `timestamps` (state→time map) | ✅ | ❌ | Yes — state transition timeline |
| `vertices[]` | ✅ | ✅ | No |
| `plan` | ✅ | ✅ | No |
| `status-counts` | ✅ | ❌ | Minor — we derive from vertices |

### Checkpoint Config Fields
| Field | Flink UI | Our Dashboard | Gap? |
|---|---|---|---|
| `mode` | ✅ | ✅ | No |
| `interval` | ✅ | ✅ | No |
| `timeout` | ✅ | ✅ | No |
| `min_pause` | ✅ | ✅ (`minPause`) | No |
| `max_concurrent` | ✅ | ✅ (`maxConcurrent`) | No |
| `externalization.enabled` | ✅ | ❌ | Yes |
| `externalization.delete_on_cancellation` | ✅ | ❌ | Yes |
| `state_backend` | ✅ | ❌ | Yes — useful context |
| `checkpoint_storage` | ✅ | ❌ | Yes — useful context |
| `unaligned_checkpoints` | ✅ | ❌ | Yes |
| `tolerable_failed_checkpoints` | ✅ | ❌ | Yes |

---

## V. Priority Recommendations

### P0 — Critical for Feature Parity (Wire existing mock pages to real API)
1. **`GET /taskmanagers`** — TM list page exists, needs real data
2. **`GET /taskmanagers/:tmid`** — TM detail page exists, needs real data
3. **`GET /jobmanager/config`** — JM page exists, needs real data
4. **`GET /jobmanager/metrics`** / `?get=` — JM metrics tab exists
5. **`GET /jobmanager/log`** — JM logs tab exists
6. **`GET /jobmanager/stdout`** — JM stdout tab exists
7. **`GET /jobmanager/thread-dump`** — JM thread dump tab exists
8. **`GET /taskmanagers/:tmid/log`** — TM logs tab exists
9. **`GET /taskmanagers/:tmid/stdout`** — TM stdout tab exists
10. **`GET /taskmanagers/:tmid/thread-dump`** — TM thread dump tab exists

### P1 — Important for Complete Job Monitoring
11. **`GET /config`** — Feature flags control which actions to show
12. **`GET /jobs/:jid/yarn-cancel`** — Job cancellation
13. **`GET /jobs/:jid/checkpoints/details/:cpid`** — Checkpoint drill-down
14. **`GET /jobs/:jid/vertices/:vid/metrics` + `?get=`** — Custom metric charting
15. **`GET /jobs/:jid/vertices/:vid/subtasks/metrics?get=`** — Data skew with aggregates
16. **`GET /jobs/:jid/vertices/:vid/subtasktimes`** — Subtask Gantt timeline
17. **`GET /jobs/:jid/vertices/:vid/flamegraph`** — CPU flame graphs

### P2 — Nice to Have
18. **`GET /jars` + `POST /jars/upload` + `POST /jars/:id/run`** — JAR submission workflow
19. **`GET /jobs/:jid/vertices/:vid/taskmanagers`** — Vertex→TM mapping
20. **`GET/PUT /jobs/:jid/resource-requirements`** — Rescaling
21. **Profiler endpoints** (JM + TM) — `profiler` list/create/download
22. **`GET /jobmanager/logs`** — JM log file list
23. **`GET /taskmanagers/:tmid/logs`** — TM log file list
24. **`GET /jobmanager/environment`** — JVM info

### P3 — Future / Specialized
25. History Server endpoints
26. Application Mode endpoints
27. `slots-free-and-blocked` / `taskmanagers-blocked` fields

---

## VI. Architecture Notes for Implementation

### Our Aggregation Pattern (Advantage)
Our `/api/flink/jobs/[jobId]/detail` route aggregates 5+N*4 Flink endpoints into a single response. This is a **significant improvement** over the Flink UI's approach of making individual calls per drawer/tab:
- Flink UI: Opening subtasks tab → 1 call. Opening backpressure tab → 1 call. Opening accumulators tab → 1 call. Each vertex click → new calls.
- Our dashboard: Single call gets everything. Frontend has all data immediately.

**Trade-off**: For jobs with many vertices (50+), our aggregate call makes 200+ sub-requests. Consider:
- Adding pagination/lazy-loading for large jobs
- Making per-vertex data optional (fetch on vertex click)
- Adding a `?vertices=vid1,vid2` query param for selective fetching

### New Routes Needed
For P0, we need these new API routes:
```
GET /api/flink/taskmanagers                    → GET /taskmanagers
GET /api/flink/taskmanagers/[tmId]/detail       → GET /taskmanagers/:tmid (+ metrics aggregate)
GET /api/flink/taskmanagers/[tmId]/log          → GET /taskmanagers/:tmid/log
GET /api/flink/taskmanagers/[tmId]/stdout       → GET /taskmanagers/:tmid/stdout
GET /api/flink/taskmanagers/[tmId]/thread-dump  → GET /taskmanagers/:tmid/thread-dump
GET /api/flink/taskmanagers/[tmId]/logs         → GET /taskmanagers/:tmid/logs
GET /api/flink/taskmanagers/[tmId]/logs/[name]  → GET /taskmanagers/:tmid/logs/:logName
GET /api/flink/jobmanager/config               → GET /jobmanager/config
GET /api/flink/jobmanager/metrics              → GET /jobmanager/metrics?get=...
GET /api/flink/jobmanager/log                  → GET /jobmanager/log
GET /api/flink/jobmanager/stdout               → GET /jobmanager/stdout
GET /api/flink/jobmanager/thread-dump          → GET /jobmanager/thread-dump
GET /api/flink/jobmanager/logs                 → GET /jobmanager/logs
GET /api/flink/jobmanager/logs/[name]          → GET /jobmanager/logs/:logName
GET /api/flink/config                          → GET /config
```

### Type Files Needed
For each new route:
1. Add raw Flink types to `flink-api-types.ts`
2. Add mapper functions to `flink-api-mappers.ts`
3. Domain types already exist in `cluster-types.ts` (TM/JM types already defined for mock)
4. Add client functions to `flink-api-client.ts`
5. Update stores to call real API instead of mock generators
