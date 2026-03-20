package simulation

import (
	"context"
	"fmt"
	"time"
)

// ScenarioFunc is the function signature for a simulation scenario.
// It receives a cancellable context, the engine (for adding observations),
// and the run being executed. It should return nil on success or an error on failure.
type ScenarioFunc func(ctx context.Context, e *Engine, run *SimulationRun) error

// SimulationPreset describes an available simulation scenario.
type SimulationPreset struct {
	Name              string
	Description       string
	Scenario          string
	DefaultParameters map[string]any
	Category          string
}

// scenarioRegistry maps scenario keys to their implementation functions.
var scenarioRegistry = map[string]ScenarioFunc{
	"resource.under-provisioned": scenarioUnderProvisioned,
	"resource.over-provisioned":  scenarioOverProvisioned,
	"resource.memory-pressure":   scenarioMemoryPressure,
	"checkpoint.pressure":        scenarioCheckpointPressure,
	"checkpoint.timeout":         scenarioCheckpointTimeout,
	"load.spike":                 scenarioLoadSpike,
	"load.sustained-overload":    scenarioSustainedOverload,
	"load.kafka-rebalance":       scenarioKafkaRebalance,
	"failure.tm-crash":           scenarioTMCrash,
	"failure.kafka-restart":      scenarioKafkaRestart,
	"failure.cascade":            scenarioCascadeFailure,
}

// presets returns all available simulation presets.
func presets() []SimulationPreset {
	return []SimulationPreset{
		{
			Name:        "Under-Provisioned Pipeline",
			Description: "Reduce parallelism and memory of a heavy pipeline to observe backpressure, checkpoint degradation, and potential OOM",
			Scenario:    "resource.under-provisioned",
			DefaultParameters: map[string]any{
				"parallelism": 1,
				"tmMemory":    "512m",
				"durationSec": 300,
			},
			Category: "resource",
		},
		{
			Name:        "Over-Provisioned Pipeline",
			Description: "Rescale a low-volume pipeline to excessive parallelism to observe wasted slots and minimal per-subtask utilization",
			Scenario:    "resource.over-provisioned",
			DefaultParameters: map[string]any{
				"newParallelism": 16,
				"durationSec":    300,
			},
			Category: "resource",
		},
		{
			Name:        "Memory Pressure",
			Description: "Reduce TM heap by 60% on a pipeline with large pattern-matching state to observe GC pressure and cache eviction",
			Scenario:    "resource.memory-pressure",
			DefaultParameters: map[string]any{
				"heapReduction": 0.6,
				"durationSec":   300,
			},
			Category: "resource",
		},
		{
			Name:        "Checkpoint Pressure",
			Description: "Reduce checkpoint interval from 30s to 3s on a pipeline with large join state to observe checkpoint overlap and failures",
			Scenario:    "checkpoint.pressure",
			DefaultParameters: map[string]any{
				"checkpointInterval": "3s",
				"durationSec":        300,
			},
			Category: "checkpoint",
		},
		{
			Name:        "Checkpoint Timeout",
			Description: "Set checkpoint timeout to 5s to force checkpoint failures on pipelines with large state",
			Scenario:    "checkpoint.timeout",
			DefaultParameters: map[string]any{
				"checkpointTimeout": "5s",
				"durationSec":       180,
			},
			Category: "checkpoint",
		},
		{
			Name:        "Sudden Load Spike",
			Description: "Flood a Kafka topic with 16x normal message rate for 2 minutes to observe backpressure propagation and recovery",
			Scenario:    "load.spike",
			DefaultParameters: map[string]any{
				"spikeRate":   50000,
				"durationSec": 120,
			},
			Category: "load",
		},
		{
			Name:        "Sustained Overload",
			Description: "Gradually ramp message rate from 1K to 100K msg/s over 5 minutes to find the throughput ceiling",
			Scenario:    "load.sustained-overload",
			DefaultParameters: map[string]any{
				"startRate":   1000,
				"endRate":     100000,
				"rampMinutes": 5,
			},
			Category: "load",
		},
		{
			Name:        "Kafka Partition Rebalance",
			Description: "Increase topic partition count to trigger consumer rebalance and observe processing pause",
			Scenario:    "load.kafka-rebalance",
			DefaultParameters: map[string]any{
				"newPartitions": 24,
			},
			Category: "load",
		},
		{
			Name:        "TaskManager Crash",
			Description: "Kill a TaskManager pod to observe job restart, checkpoint restoration, and recovery time",
			Scenario:    "failure.tm-crash",
			DefaultParameters: map[string]any{
				"observationSec": 180,
			},
			Category: "failure",
		},
		{
			Name:        "Kafka Broker Restart",
			Description: "Restart the Kafka pod to observe source errors across all connected pipelines and automatic recovery",
			Scenario:    "failure.kafka-restart",
			DefaultParameters: map[string]any{
				"gracePeriod":    0,
				"observationSec": 300,
			},
			Category: "failure",
		},
		{
			Name:        "Cascading Failure",
			Description: "Kill a data pump pipeline to starve all downstream processing pipelines and observe dependency chain effects",
			Scenario:    "failure.cascade",
			DefaultParameters: map[string]any{
				"starvationSec": 180,
			},
			Category: "failure",
		},
	}
}

// --- Scenario implementations (stubs — full logic requires minikube infrastructure) ---

func scenarioStub(ctx context.Context, e *Engine, run *SimulationRun, name string, durationSec int) error {
	e.logger.Info("simulation started", "scenario", name, "run_id", run.ID)

	if err := e.AddObservation(ctx, run.ID, "status", 1, fmt.Sprintf("%s scenario started", name)); err != nil {
		return err
	}

	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	elapsed := 0
	for elapsed < durationSec {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			elapsed += 5
			if err := e.AddObservation(ctx, run.ID, "elapsed_sec", float64(elapsed), ""); err != nil {
				return err
			}
		}
	}

	if err := e.AddObservation(ctx, run.ID, "status", 0, fmt.Sprintf("%s scenario completed", name)); err != nil {
		return err
	}
	return nil
}

func getDurationSec(run *SimulationRun, key string, fallback int) int {
	if v, ok := run.Parameters[key]; ok {
		switch val := v.(type) {
		case float64:
			return int(val)
		case int:
			return val
		}
	}
	return fallback
}

func scenarioUnderProvisioned(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "under-provisioned", getDurationSec(run, "durationSec", 300))
}

func scenarioOverProvisioned(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "over-provisioned", getDurationSec(run, "durationSec", 300))
}

func scenarioMemoryPressure(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "memory-pressure", getDurationSec(run, "durationSec", 300))
}

func scenarioCheckpointPressure(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "checkpoint-pressure", getDurationSec(run, "durationSec", 300))
}

func scenarioCheckpointTimeout(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "checkpoint-timeout", getDurationSec(run, "durationSec", 180))
}

func scenarioLoadSpike(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "load-spike", getDurationSec(run, "durationSec", 120))
}

func scenarioSustainedOverload(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "sustained-overload", getDurationSec(run, "rampMinutes", 5)*60)
}

func scenarioKafkaRebalance(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "kafka-rebalance", 120)
}

func scenarioTMCrash(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "tm-crash", getDurationSec(run, "observationSec", 180))
}

func scenarioKafkaRestart(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "kafka-restart", getDurationSec(run, "observationSec", 300))
}

func scenarioCascadeFailure(ctx context.Context, e *Engine, run *SimulationRun) error {
	return scenarioStub(ctx, e, run, "cascade-failure", getDurationSec(run, "starvationSec", 180))
}
