// Package savepoints tracks server-side context about Flink savepoints that
// is not preserved by Flink's REST API.
//
// Flink's `GET /jobs/:id/savepoints` returns operation status, location, size,
// and timestamps — but no structured reason for *why* a savepoint was taken.
// The server intercepts its own savepoint-triggering mutations and stamps the
// trigger reason here so the dashboard can render it.
//
// The cache is memory-only and single-process; entries are lost on restart.
// Savepoints created before a restart fall back to the default trigger type
// (MANUAL), which is acceptable for v1.
package savepoints

import (
	"sync"
)

// TriggerType enumerates the server-known reasons for triggering a savepoint.
// String values match the GraphQL enum SavepointTriggerType.
type TriggerType string

// Savepoint trigger reasons known to the server.
const (
	TriggerManual            TriggerType = "MANUAL"
	TriggerStopWithSavepoint TriggerType = "STOP_WITH_SAVEPOINT" //nolint:gosec // G101: enum value; "StopWithSavepoint" contains "pw", which trips the credential heuristic
	TriggerBlueGreen         TriggerType = "BLUE_GREEN"
)

// TriggerTypeCache maps (cluster, jobID, savepointID) → TriggerType.
//
// The zero value is not ready for use; construct via NewTriggerTypeCache.
type TriggerTypeCache struct {
	mu      sync.RWMutex
	entries map[triggerKey]TriggerType
}

type triggerKey struct {
	cluster     string
	jobID       string
	savepointID string
}

// NewTriggerTypeCache returns an empty cache.
func NewTriggerTypeCache() *TriggerTypeCache {
	return &TriggerTypeCache{entries: map[triggerKey]TriggerType{}}
}

// Record stamps the trigger type for a (cluster, jobID, savepointID) tuple.
// Subsequent calls for the same tuple overwrite the previous value.
func (c *TriggerTypeCache) Record(cluster, jobID, savepointID string, t TriggerType) {
	c.mu.Lock()
	defer c.mu.Unlock()
	c.entries[triggerKey{cluster, jobID, savepointID}] = t
}

// RecordManual is a convenience for Record(..., TriggerManual).
func (c *TriggerTypeCache) RecordManual(cluster, jobID, savepointID string) {
	c.Record(cluster, jobID, savepointID, TriggerManual)
}

// RecordStopWithSavepoint is a convenience for Record(..., TriggerStopWithSavepoint).
func (c *TriggerTypeCache) RecordStopWithSavepoint(cluster, jobID, savepointID string) {
	c.Record(cluster, jobID, savepointID, TriggerStopWithSavepoint)
}

// RecordBlueGreen is a convenience for Record(..., TriggerBlueGreen).
//
// Reactor-server does not initiate blue/green savepoints itself today — the
// Flink Kubernetes Operator triggers them externally. This method exists so
// any future server-side BG controller can mark its own savepoints without
// re-plumbing the cache API.
func (c *TriggerTypeCache) RecordBlueGreen(cluster, jobID, savepointID string) {
	c.Record(cluster, jobID, savepointID, TriggerBlueGreen)
}

// Lookup returns the recorded trigger type for a savepoint. If no entry
// exists, TriggerManual is returned — matching the spec's
// "unknown trigger defaults to MANUAL" requirement.
func (c *TriggerTypeCache) Lookup(cluster, jobID, savepointID string) TriggerType {
	c.mu.RLock()
	defer c.mu.RUnlock()
	if t, ok := c.entries[triggerKey{cluster, jobID, savepointID}]; ok {
		return t
	}
	return TriggerManual
}
