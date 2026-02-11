# Flink REST API Reference

Pre-extracted reference for every Flink REST endpoint the dashboard consumes. Consult this instead of re-reading `flink-api-types.ts` or external Flink docs.

## Endpoint Catalog

| Endpoint | Method | Proxy Route | Purpose |
|----------|--------|-------------|---------|
| `/overview` | GET | `/api/flink/overview` | Cluster stats: version, commit, slots, job counts, TM count |
| `/jobs/overview` | GET | `/api/flink/jobs/overview` | All jobs with state, timestamps, task counts |
| `/jobs/:jid` | GET | (aggregated) | Job detail: vertices, plan, timestamps, status-counts |
| `/jobs/:jid/exceptions` | GET | (aggregated) | Exception history (Flink 1.20+: `exceptionHistory.entries[]`) |
| `/jobs/:jid/checkpoints` | GET | (aggregated) | Checkpoint history + counts |
| `/jobs/:jid/checkpoints/config` | GET | (aggregated) | Checkpoint mode, interval, timeout, concurrency |
| `/jobs/:jid/config` | GET | (aggregated) | Job config: execution-mode, restart-strategy, user-config |
| `/jobs/:jid/vertices/:vid` | GET | (aggregated) | Per-vertex subtask detail |
| `/jobs/:jid/vertices/:vid/watermarks` | GET | (aggregated) | Bare JSON array of `{id, value}` metrics |
| `/jobs/:jid/vertices/:vid/backpressure` | GET | (aggregated) | Vertex + subtask backpressure levels/ratios |
| `/jobs/:jid/vertices/:vid/accumulators` | GET | (aggregated) | User accumulators per vertex |

All endpoints marked "(aggregated)" are fetched by the `/api/flink/jobs/[jobId]/detail` proxy route.

## Two-Phase Fetch Strategy

The job detail proxy route (`src/app/api/flink/jobs/[jobId]/detail/route.ts`) uses two phases:

**Phase 1** — Independent endpoints in `Promise.all`:
- `/jobs/:jid` (job detail)
- `/jobs/:jid/exceptions`
- `/jobs/:jid/checkpoints`
- `/jobs/:jid/checkpoints/config`
- `/jobs/:jid/config`

**Phase 2** — Per-vertex endpoints (requires vertex IDs from Phase 1):
- `/jobs/:jid/vertices/:vid` — **critical**: errors propagate (no fallback)
- `/jobs/:jid/vertices/:vid/watermarks` — **supplementary**: falls back to `[]`
- `/jobs/:jid/vertices/:vid/backpressure` — **supplementary**: falls back to `{status:"ok", ...}`
- `/jobs/:jid/vertices/:vid/accumulators` — **supplementary**: falls back to `{id:"", "user-accumulators":[]}`

## State Enums

### Job States (10 Flink → 10 domain, pass-through)

`CREATED | RUNNING | FAILING | FAILED | CANCELLING | CANCELED | FINISHED | RESTARTING | SUSPENDED | RECONCILING`

Unknown values default to `CREATED`.

**Running bucket** (for splitting into running vs completed tables): `RUNNING`, `CREATED`, `RESTARTING`, `RECONCILING`

### Vertex/Task States (10 Flink → 5 domain)

| Domain State | Flink States |
|-------------|--------------|
| `CREATED` | CREATED, SCHEDULED, DEPLOYING, RECONCILING, INITIALIZING |
| `RUNNING` | RUNNING |
| `FINISHED` | FINISHED |
| `CANCELED` | CANCELING, CANCELED |
| `FAILED` | FAILED |

### Task Counts Collapse (10 → 5)

| Domain Field | Flink Fields Summed |
|-------------|---------------------|
| `pending` | created + scheduled + deploying + reconciling + initializing |
| `running` | running |
| `finished` | finished |
| `canceling` | canceling + canceled |
| `failed` | failed |

### Checkpoint Status

`COMPLETED | IN_PROGRESS | FAILED` — raw API may use other values, default to `IN_PROGRESS`.

### Checkpoint Mode

`EXACTLY_ONCE | AT_LEAST_ONCE`

### Ship Strategies

`FORWARD | HASH | REBALANCE | BROADCAST | RESCALE | GLOBAL` — unknown values default to `FORWARD`.

### Backpressure Levels

`ok | low | high` — applies to both vertex-level and subtask-level.

## API Quirks

- **Hyphenated JSON keys**: Overview and many endpoints use `"flink-version"`, `"slots-total"`, `"start-time"`, `"end-time"`, etc. Raw types mirror these exactly.
- **`end-time: -1` sentinel**: Means the job/vertex is still running. Mapped to `null` in domain types.
- **Task counts casing**: Job overview uses **lowercase** keys (`created`, `running`). Vertex detail uses **UPPERCASE** keys (`CREATED`, `RUNNING`). Two separate mapper functions handle this.
- **Watermarks response**: Bare JSON array (not wrapped in an object). Metric IDs follow pattern `N.currentInputWatermark` where N is subtask index.
- **Backpressure status field**: `"deprecated" | "ok"` at the vertex level — this is the sampling status, not the pressure level.
- **Exception format**: Flink 1.20+ uses `exceptionHistory.entries[]` (the old `all-exceptions` field was removed).
- **Plan node inputs**: Use `ship_strategy` (underscore, not hyphen) and `id` references the source vertex.

## Metrics Conversion

Flink reports **accumulated totals** for busy/backpressured/idle time. The dashboard converts to **per-second rates**:

```
rate = Math.round(accumulatedMs / Math.max(1, durationMs / 1000))
```

This applies to both vertex-level metrics (`mapVertexMetrics`) and subtask-level metrics (`mapSubtaskMetrics`).

## Response Type Summary

The aggregate envelope assembled by the proxy route:

```typescript
FlinkJobDetailAggregate {
  job: FlinkJobDetailResponse          // core job + vertices + plan
  exceptions: FlinkJobExceptionsResponse
  checkpoints: FlinkCheckpointingStatistics
  checkpointConfig: FlinkCheckpointConfigResponse
  jobConfig: FlinkJobConfigResponse
  vertexDetails: Record<vid, FlinkVertexDetailResponse>
  watermarks: Record<vid, FlinkWatermarksResponse>
  backpressure: Record<vid, FlinkVertexBackPressureResponse>
  accumulators: Record<vid, FlinkVertexAccumulatorsResponse>
}
```
