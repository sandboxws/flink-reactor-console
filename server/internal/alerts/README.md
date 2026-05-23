# internal/alerts — Server-side alerts engine

This package owns the alert evaluation loop, the lifecycle state machine, and
Postgres LISTEN/NOTIFY fan-out for GraphQL subscriptions.

## Pieces

| File | Role |
|---|---|
| `types.go` | Shared structs — `ClusterSnapshot`, `EvalResult`, `InstanceEvent`. |
| `conditions.go` | The five v1 condition evaluators (slot exhaustion, backpressure, checkpoint failure, TM memory, TM lost) plus the dispatcher. |
| `evaluator.go` | Tick-driven evaluation loop, bounded worker pool, auto-resolve scan. |
| `listener.go` | Long-lived Postgres `LISTEN alert_state_change` connection. Re-publishes payloads onto the in-process bus. |
| `engine.go` | Top-level wrapper — wires Evaluator + Listener and owns the `EventBus[InstanceEvent]` that subscription resolvers consume. |

Storage lives in `internal/store/alerts.go` (queries) and
`internal/storage/alerts_models.go` (DB types + constants). The migration
that creates the tables and the LISTEN/NOTIFY trigger is
`internal/storage/migrations/009_alerts.sql`.

## Condition DSL

Each rule's `condition` column is a JSONB document of the form:

```json
{ "type": "SLOT_EXHAUSTION", "threshold": 10, "windowSec": 300 }
```

Accepted `type` values (v1):

- `SLOT_EXHAUSTION` — fires when free-slot percentage drops below threshold.
- `BACKPRESSURE` — fires when the cluster backpressure proxy score drops
  below threshold.
- `CHECKPOINT_FAILURE` — fires when rolling checkpoint success rate drops
  below threshold.
- `TM_MEMORY` — fires per-TM when heap usage exceeds threshold (percent).
- `TM_LOST` — fires when registered TM count drops below threshold.

The `windowSec` field is reserved for future smoothing/aggregation — v1
evaluates on the current snapshot only.

## Dedup

The `alert_instances` table has a partial unique index:

```sql
UNIQUE (rule_id, dedup_key) WHERE state IN ('FIRING', 'ACKNOWLEDGED')
```

so at most one open instance can exist per `(rule, target)`. Each condition
type chooses its own dedup-key scope (per cluster for cluster-wide
conditions; per TM for TM-scoped ones).

## Lifecycle

```
        ┌─────────┐  ack  ┌──────────────┐
        │ FIRING  │──────▶│ ACKNOWLEDGED │
        └─────────┘       └──────────────┘
             │ silence           │
             ▼                   │
        ┌─────────┐               │ resolve
        │SILENCED │               │  (manual or auto after 30s
        └─────────┘               │   of last_seen_at being stale)
             │                    │
             └──── resolve ───────┴────▶ RESOLVED
```

Invalid transitions return `ErrInvalidStateTransition`. Auto-resolve is
driven by a background scan in `evaluator.runAutoResolve`.

## Fan-out

Every state transition triggers `pg_notify('alert_state_change', ...)`.
`listener.go` holds a long-lived connection, decodes payloads, looks up the
affected instance, and re-publishes onto the in-process `EventBus`. The
GraphQL subscription resolvers in `internal/graphql/alerts.resolvers.go`
subscribe to that bus and stream filtered events to dashboards.

Postgres pub/sub means subscription fan-out works correctly across server
replicas when we eventually scale horizontally — no in-memory state to
coordinate.

## Adding a new condition type

1. Add a constant to `storage/alerts_models.go` and update
   `IsValidAlertConditionType`.
2. Add a case to `EvaluateCondition` in `conditions.go` and write an
   evaluator function returning `[]EvalResult`.
3. Add the value to the `AlertConditionType` enum in
   `graphql/schema/alerts.graphqls`.
4. Run `just generate`.
