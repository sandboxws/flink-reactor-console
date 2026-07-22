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

func TestProcessMemoryHeadroomFires(t *testing.T) {
	// heap 400 + managed 400 + metaspace 50 + network 50 = 900 of the 1000
	// Total Process Memory ceiling = 90%, over the 85% threshold.
	snap := ClusterSnapshot{
		Cluster: "primary",
		TaskManagers: []flink.TaskManagerItem{
			{
				ID:                  "tm-1",
				MemoryConfiguration: flink.TaskManagerMemory{TotalProcessMemory: 1000},
			},
		},
		TMMetrics: map[string]map[string]float64{
			"tm-1": {
				"Status.JVM.Memory.Heap.Used":      400,
				"Status.Flink.Memory.Managed.Used": 400,
				"Status.JVM.Memory.Metaspace.Used": 50,
				"Status.Shuffle.Netty.UsedMemory":  50,
			},
		},
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionProcessMemoryHeadroom, Threshold: 85,
	})
	if len(results) != 1 || !results[0].Fired {
		t.Fatalf("expected fire at 90%% of limit, got %#v", results)
	}
}

func TestProcessMemoryHeadroomSkipsWithoutLiveMetrics(t *testing.T) {
	snap := ClusterSnapshot{
		Cluster: "primary",
		TaskManagers: []flink.TaskManagerItem{
			{
				ID:                  "tm-1",
				MemoryConfiguration: flink.TaskManagerMemory{TotalProcessMemory: 1000},
			},
		},
		// No TMMetrics → no aggregate proxy → skip rather than false-alarm.
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionProcessMemoryHeadroom, Threshold: 85,
	})
	if len(results) != 0 {
		t.Fatalf("expected no fire without live metrics, got %#v", results)
	}
}

func TestGCPressureFiresOnHighRate(t *testing.T) {
	// young 180 + old 60 = 240 ms of GC per second, over the 200 threshold.
	snap := ClusterSnapshot{
		Cluster:      "primary",
		TaskManagers: []flink.TaskManagerItem{{ID: "tm-1"}},
		TMMetrics: map[string]map[string]float64{
			"tm-1": {
				"Status.JVM.GarbageCollector.G1_Young_Generation.TimeMsPerSecond": 180,
				"Status.JVM.GarbageCollector.G1_Old_Generation.TimeMsPerSecond":   60,
			},
		},
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionGCPressure, Threshold: 200,
	})
	if len(results) != 1 || !results[0].Fired {
		t.Fatalf("expected fire at 240 ms/s, got %#v", results)
	}
	if results[0].CurrentValue != 240 {
		t.Fatalf("expected rate 240, got %.1f", results[0].CurrentValue)
	}
}

func TestCheckpointSizeGrowthFiresPerJob(t *testing.T) {
	// job-1 grew 80% (over threshold), job-2 only 10% (under).
	snap := ClusterSnapshot{
		Cluster:          "primary",
		CheckpointGrowth: map[string]float64{"job-1": 80, "job-2": 10},
	}
	results := EvaluateCondition(snap, storage.AlertConditionPayload{
		Type: storage.AlertConditionCheckpointSizeGrowth, Threshold: 50,
	})
	if len(results) != 1 || !results[0].Fired {
		t.Fatalf("expected exactly one job to fire, got %#v", results)
	}
	if results[0].DedupKey != "cluster:primary:job:job-1" {
		t.Fatalf("wrong dedup key %q", results[0].DedupKey)
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
