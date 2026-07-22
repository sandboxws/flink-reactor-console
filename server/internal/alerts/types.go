// Package alerts implements the server-side alert engine: rule evaluation,
// instance lifecycle, dedup, auto-resolve, and Postgres LISTEN/NOTIFY
// fan-out for GraphQL subscriptions.
package alerts

import (
	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
)

// ClusterSnapshot is a point-in-time view of cluster state used by condition
// evaluators. The evaluator builds one per tick and dispatches it to every
// matching rule.
type ClusterSnapshot struct {
	Cluster      string
	Overview     *flink.ClusterOverview
	TaskManagers []flink.TaskManagerItem
	// TMMetrics maps TaskManager id -> metric id -> latest persisted value,
	// read from the metric store so TM_MEMORY can judge managed/off-heap
	// pressure and not just heap. Nil/empty when the store is unavailable; in
	// that case evaluators fall back to config/resource-profile proxies.
	TMMetrics map[string]map[string]float64
	Jobs      []flink.JobOverview
	// CheckpointSuccessRate is computed from the most recent checkpoint
	// statistics across all running jobs; in [0, 100]. -1 if unavailable.
	CheckpointSuccessRate float64
}

// EvalResult is the outcome of a single rule evaluation against a snapshot.
// Multiple results may be produced per rule for per-target conditions (e.g.
// each TM contributes its own dedup_key in TM_MEMORY).
type EvalResult struct {
	Fired        bool
	DedupKey     string
	Message      string
	CurrentValue float64
	Context      map[string]any
}

// EventKind enumerates the lifecycle events emitted to the in-process bus.
type EventKind string

const (
	// EventFired is published when a new instance opens (state FIRING).
	EventFired EventKind = "FIRED"
	// EventResolved is published when an instance transitions to RESOLVED.
	EventResolved EventKind = "RESOLVED"
	// EventStateChanged is published for ACK/SILENCED transitions.
	EventStateChanged EventKind = "STATE_CHANGED"
)

// InstanceEvent is the payload delivered to subscribers of the alerts bus.
type InstanceEvent struct {
	Kind     EventKind
	Instance storage.DBAlertInstance
}
