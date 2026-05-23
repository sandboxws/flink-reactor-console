package alerts

import (
	"encoding/json"
	"fmt"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// EvaluateCondition dispatches to the per-type evaluator. Each evaluator may
// return zero, one, or many EvalResults (e.g. TM_MEMORY emits one per TM).
func EvaluateCondition(snap ClusterSnapshot, cond storage.AlertConditionPayload) []EvalResult {
	switch cond.Type {
	case storage.AlertConditionSlotExhaustion:
		return evalSlotExhaustion(snap, cond)
	case storage.AlertConditionBackpressure:
		return evalBackpressure(snap, cond)
	case storage.AlertConditionCheckpointFailure:
		return evalCheckpointFailure(snap, cond)
	case storage.AlertConditionTMMemory:
		return evalTMMemory(snap, cond)
	case storage.AlertConditionTMLost:
		return evalTMLost(snap, cond)
	}
	return nil
}

// SLOT_EXHAUSTION fires when free-slot percentage drops below the threshold
// (expressed as a percentage, 0–100). Dedup is per-cluster.
func evalSlotExhaustion(snap ClusterSnapshot, cond storage.AlertConditionPayload) []EvalResult {
	if snap.Overview == nil || snap.Overview.SlotsTotal == 0 {
		return nil
	}
	freePct := (float64(snap.Overview.SlotsAvailable) / float64(snap.Overview.SlotsTotal)) * 100.0
	if freePct >= cond.Threshold {
		return nil
	}
	return []EvalResult{{
		Fired:        true,
		DedupKey:     fmt.Sprintf("cluster:%s", snap.Cluster),
		CurrentValue: freePct,
		Message:      fmt.Sprintf("Free slots at %.1f%% (threshold: < %.1f%%)", freePct, cond.Threshold),
		Context: map[string]any{
			"slotsTotal":     snap.Overview.SlotsTotal,
			"slotsAvailable": snap.Overview.SlotsAvailable,
			"freePercent":    freePct,
		},
	}}
}

// BACKPRESSURE fires when the cluster-level backpressure score (derived from
// failed jobs ratio in v1) drops below the threshold. Dedup per-cluster.
func evalBackpressure(snap ClusterSnapshot, cond storage.AlertConditionPayload) []EvalResult {
	if snap.Overview == nil {
		return nil
	}
	totalJobs := snap.Overview.JobsRunning + snap.Overview.JobsFinished + snap.Overview.JobsFailed + snap.Overview.JobsCancelled
	if totalJobs == 0 {
		return nil
	}
	// Simple proxy: 100 - failedRatio * 100 — higher is healthier. v1 parity.
	score := 100.0 * (1.0 - float64(snap.Overview.JobsFailed)/float64(totalJobs))
	if score >= cond.Threshold {
		return nil
	}
	return []EvalResult{{
		Fired:        true,
		DedupKey:     fmt.Sprintf("cluster:%s", snap.Cluster),
		CurrentValue: score,
		Message:      fmt.Sprintf("Backpressure score %.1f (threshold: < %.1f)", score, cond.Threshold),
		Context: map[string]any{
			"score":      score,
			"failedJobs": snap.Overview.JobsFailed,
			"totalJobs":  totalJobs,
		},
	}}
}

// CHECKPOINT_FAILURE fires when the rolling checkpoint success rate drops
// below the threshold (0–100 percentage). Dedup per-cluster.
func evalCheckpointFailure(snap ClusterSnapshot, cond storage.AlertConditionPayload) []EvalResult {
	if snap.CheckpointSuccessRate < 0 {
		return nil
	}
	if snap.CheckpointSuccessRate >= cond.Threshold {
		return nil
	}
	return []EvalResult{{
		Fired:        true,
		DedupKey:     fmt.Sprintf("cluster:%s", snap.Cluster),
		CurrentValue: snap.CheckpointSuccessRate,
		Message:      fmt.Sprintf("Checkpoint success rate %.1f%% (threshold: < %.1f%%)", snap.CheckpointSuccessRate, cond.Threshold),
		Context: map[string]any{
			"successRate": snap.CheckpointSuccessRate,
		},
	}}
}

// TM_MEMORY fires once per task manager whose JVM heap usage exceeds the
// threshold (as a percentage of total). Each TM has its own dedup_key so they
// can be acknowledged independently.
func evalTMMemory(snap ClusterSnapshot, cond storage.AlertConditionPayload) []EvalResult {
	var out []EvalResult
	for _, tm := range snap.TaskManagers {
		total := tm.MemoryConfiguration.TaskHeap + tm.MemoryConfiguration.FrameworkHeap
		if total <= 0 {
			continue
		}
		// We don't have live used-heap in the TaskManagerList payload; use
		// the proxy: allocated-vs-total managed memory as a stand-in.
		used := total - tm.FreeResource.TaskHeapMemory
		if used < 0 || used > total*2 {
			continue
		}
		pct := (float64(used) / float64(total)) * 100.0
		if pct <= cond.Threshold {
			continue
		}
		out = append(out, EvalResult{
			Fired:        true,
			DedupKey:     fmt.Sprintf("cluster:%s:tm:%s", snap.Cluster, tm.ID),
			CurrentValue: pct,
			Message:      fmt.Sprintf("TM %s heap at %.1f%% (threshold: > %.1f%%)", tm.ID, pct, cond.Threshold),
			Context: map[string]any{
				"taskManagerId": tm.ID,
				"heapPercent":   pct,
			},
		})
	}
	return out
}

// TM_LOST fires when the number of registered TMs drops below the threshold.
// Dedup per-cluster.
func evalTMLost(snap ClusterSnapshot, cond storage.AlertConditionPayload) []EvalResult {
	count := float64(len(snap.TaskManagers))
	if count >= cond.Threshold {
		return nil
	}
	return []EvalResult{{
		Fired:        true,
		DedupKey:     fmt.Sprintf("cluster:%s", snap.Cluster),
		CurrentValue: count,
		Message:      fmt.Sprintf("Task managers count %.0f (threshold: < %.0f)", count, cond.Threshold),
		Context: map[string]any{
			"taskManagerCount": count,
		},
	}}
}

// DecodeCondition parses a JSONB condition payload from storage.
func DecodeCondition(raw json.RawMessage) (storage.AlertConditionPayload, error) {
	var p storage.AlertConditionPayload
	if err := json.Unmarshal(raw, &p); err != nil {
		return p, fmt.Errorf("decode condition: %w", err)
	}
	if !storage.IsValidAlertConditionType(p.Type) {
		return p, fmt.Errorf("unknown condition type: %s", p.Type)
	}
	return p, nil
}
