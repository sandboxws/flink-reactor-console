---
globs: src/data/**
---

# Data Layer Conventions

## Type Architecture (Three Layers)

1. **`flink-api-types.ts`** — Raw Flink REST response shapes. Keys match the JSON exactly (hyphenated: `"start-time"`, `"flink-version"`). Every interface has a `@see` link to the Flink REST API docs.
2. **`cluster-types.ts`** — Domain types used by stores and components. All camelCase. These are the "public" types the rest of the app imports.
3. **`flink-api-mappers.ts`** — Pure functions converting raw → domain. No side effects, no API calls, no store access.

## Mapper Rules

- Mappers are pure functions: input raw type, output domain type. No `fetch()`, no store reads.
- State collapse: Flink has 10 task/vertex states → dashboard uses 5 (`CREATED`, `RUNNING`, `FINISHED`, `CANCELED`, `FAILED`). See `mapVertexStatus()` and `mapTaskCounts()`.
- Unknown enum values get safe defaults: unknown job state → `CREATED`, unknown ship strategy → `FORWARD`, unknown checkpoint status → `IN_PROGRESS`.
- `end-time: -1` sentinel → `null` in domain types (means still running).

## Task Counts Casing Gotcha

- **Job overview** (`/jobs/overview`): task counts use **lowercase** keys (`created`, `running`, `finished`). Handled by `mapTaskCounts()`.
- **Vertex detail** (`/jobs/:jid`): task counts use **UPPERCASE** keys (`CREATED`, `RUNNING`, `FINISHED`). Handled by `mapUppercaseTaskCounts()`.

These are separate mapper functions — do not confuse them.

## Metrics Conversion

Flink reports accumulated totals (busy-time, backpressured-time, idle-time in ms). Convert to per-second rates:

```typescript
const durationSec = Math.max(1, durationMs / 1000);
const rate = Math.round(accumulatedMs / durationSec);
```

The `Math.max(1, ...)` prevents division by zero for freshly-started jobs.

## Test Fixtures

- `mock-tap-manifest.ts` — Factory function for tap manifests used in tests.
- All mock/test data for Flink responses lives in the Go backend (`apps/server/internal/flink/mock_data.go`).
