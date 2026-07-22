package alerts

import (
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
)

func TestSlotExhaustionFires(t *testing.T) {
	snap := ClusterSnapshot{
		Cluster:  "primary",
		Overview: &flink.ClusterOverview{SlotsTotal: 10, SlotsAvailable: 0},
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionSlotExhaustion, Threshold: 10,
	})
	if len(results) != 1 || !results[0].Fired {
		t.Fatalf("expected fire, got %#v", results)
	}
	if results[0].DedupKey != "cluster:primary" {
		t.Fatalf("unexpected dedup key %q", results[0].DedupKey)
	}
}

func TestSlotExhaustionDoesNotFireAboveThreshold(t *testing.T) {
	snap := ClusterSnapshot{
		Cluster:  "primary",
		Overview: &flink.ClusterOverview{SlotsTotal: 10, SlotsAvailable: 5},
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionSlotExhaustion, Threshold: 10,
	})
	if len(results) != 0 {
		t.Fatalf("expected no fire, got %#v", results)
	}
}

func TestTMLostFires(t *testing.T) {
	snap := ClusterSnapshot{Cluster: "primary"}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionTMLost, Threshold: 2,
	})
	if len(results) != 1 || !results[0].Fired {
		t.Fatalf("expected fire when 0 TMs vs threshold 2, got %#v", results)
	}
}

func TestTMMemoryFiresPerTM(t *testing.T) {
	snap := ClusterSnapshot{
		Cluster: "primary",
		TaskManagers: []flink.TaskManagerItem{
			{
				ID:                  "tm-1",
				MemoryConfiguration: flink.TaskManagerMemory{TaskHeap: 100, FrameworkHeap: 0},
				FreeResource:        flink.TaskManagerResourceProfile{TaskHeapMemory: 5}, // 95% used
			},
			{
				ID:                  "tm-2",
				MemoryConfiguration: flink.TaskManagerMemory{TaskHeap: 100, FrameworkHeap: 0},
				FreeResource:        flink.TaskManagerResourceProfile{TaskHeapMemory: 60}, // 40% used
			},
		},
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionTMMemory, Threshold: 90,
	})
	if len(results) != 1 {
		t.Fatalf("expected exactly one TM to fire, got %d: %#v", len(results), results)
	}
	if results[0].DedupKey != "cluster:primary:tm:tm-1" {
		t.Fatalf("wrong dedup key %q", results[0].DedupKey)
	}
}

// TestTMMemoryFiresOnManagedPressure is the 2a regression: heap is calm but the
// managed (RocksDB) pool is nearly full. The old heap-only proxy stayed silent;
// the live per-pool check must fire.
func TestTMMemoryFiresOnManagedPressure(t *testing.T) {
	snap := ClusterSnapshot{
		Cluster: "primary",
		TaskManagers: []flink.TaskManagerItem{
			{
				ID: "tm-rocks",
				MemoryConfiguration: flink.TaskManagerMemory{
					TaskHeap:      1000,
					ManagedMemory: 1000,
				},
				// ~5% heap allocation — the fallback proxy would be quiet here.
				FreeResource: flink.TaskManagerResourceProfile{TaskHeapMemory: 950},
			},
		},
		TMMetrics: map[string]map[string]float64{
			"tm-rocks": {
				"Status.JVM.Memory.Heap.Used":      200, // 20% of heap budget
				"Status.Flink.Memory.Managed.Used": 950, // 95% of managed budget
			},
		},
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionTMMemory, Threshold: 90,
	})
	if len(results) != 1 || !results[0].Fired {
		t.Fatalf("expected fire on managed pressure, got %#v", results)
	}
	if results[0].CurrentValue < 90 {
		t.Fatalf("expected pct >= 90 (managed at 95%%), got %.1f", results[0].CurrentValue)
	}
}

func TestUnknownConditionType(t *testing.T) {
	if storage.IsValidAlertConditionType("MADE_UP") {
		t.Fatal("MADE_UP should be rejected")
	}
	if !storage.IsValidAlertConditionType(storage.AlertConditionSlotExhaustion) {
		t.Fatal("SLOT_EXHAUSTION should be accepted")
	}
}

func TestCheckpointFailureNoData(t *testing.T) {
	snap := ClusterSnapshot{Cluster: "primary", CheckpointSuccessRate: -1}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionCheckpointFailure, Threshold: 99,
	})
	if len(results) != 0 {
		t.Fatalf("missing checkpoint data should yield no fire, got %#v", results)
	}
}
