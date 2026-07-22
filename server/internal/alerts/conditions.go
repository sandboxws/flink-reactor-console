package alerts

import (
	"encoding/json"
	"fmt"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
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

// TM_MEMORY fires once per task manager whose memory usage exceeds the
// threshold (percent). It prefers the worst live pool saturation — heap /
// managed / metaspace / network used vs each pool's configured budget, read
// from the metric store — so a filling managed/RocksDB or off-heap pool is
// caught, not just heap (the native-memory blind spot behind OOMKills). When
// no live metrics are available it falls back to the heap-allocation proxy.
// Each TM has its own dedup_key so they can be acknowledged independently.
func evalTMMemory(snap ClusterSnapshot, cond storage.AlertConditionPayload) []EvalResult {
	var out []EvalResult
	for _, tm := range snap.TaskManagers {
		pct, ok := tmMemoryPercent(snap.TMMetrics[tm.ID], tm)
		if !ok || pct <= cond.Threshold {
			continue
		}
		out = append(out, EvalResult{
			Fired:        true,
			DedupKey:     fmt.Sprintf("cluster:%s:tm:%s", snap.Cluster, tm.ID),
			CurrentValue: pct,
			Message:      fmt.Sprintf("TM %s memory at %.1f%% (threshold: > %.1f%%)", tm.ID, pct, cond.Threshold),
			Context: map[string]any{
				"taskManagerId": tm.ID,
				"memoryPercent": pct,
			},
		})
	}
	return out
}

// tmMemoryPercent returns a TaskManager's memory-pressure percentage and whether
// it could be computed. With live gauges present it reports the worst pool
// saturation (used ÷ that pool's configured budget), surfacing managed/off-heap
// growth that a heap-only check misses. Otherwise it falls back to the
// allocated-vs-total task-heap proxy from the TaskManagerList payload.
func tmMemoryPercent(live map[string]float64, tm flink.TaskManagerItem) (float64, bool) {
	cfg := tm.MemoryConfiguration
	if len(live) > 0 {
		worst := 0.0
		consider := func(metricID string, budget int64) {
			if budget <= 0 {
				return
			}
			if used, ok := live[metricID]; ok {
				if r := used / float64(budget); r > worst {
					worst = r
				}
			}
		}
		consider("Status.JVM.Memory.Heap.Used", cfg.TaskHeap+cfg.FrameworkHeap)
		consider("Status.Flink.Memory.Managed.Used", cfg.ManagedMemory)
		consider("Status.JVM.Memory.Metaspace.Used", cfg.JVMMetaspace)
		consider("Status.Shuffle.Netty.UsedMemory", cfg.NetworkMemory)
		if worst > 0 {
			return worst * 100.0, true
		}
	}

	// Fallback proxy: allocated-vs-total task heap (pre-2a behavior) when no
	// live metrics are available (e.g. background metric sync disabled).
	total := cfg.TaskHeap + cfg.FrameworkHeap
	if total <= 0 {
		return 0, false
	}
	used := total - tm.FreeResource.TaskHeapMemory
	if used < 0 || used > total*2 {
		return 0, false
	}
	return float64(used) / float64(total) * 100.0, true
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
