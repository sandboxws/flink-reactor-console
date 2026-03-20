package simulation

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// activeSimulation tracks a running simulation with its cancel function.
type activeSimulation struct {
	run    *SimulationRun
	cancel context.CancelFunc
}

// Engine orchestrates simulation scenario execution.
type Engine struct {
	store     *Store
	logger    *slog.Logger
	mu        sync.Mutex
	activeRun *activeSimulation
}

// NewEngine creates a new simulation engine.
func NewEngine(store *Store, logger *slog.Logger) *Engine {
	return &Engine{
		store:  store,
		logger: logger,
	}
}

// SimulationInput is the input for starting a simulation.
type SimulationInput struct {
	Scenario   string
	TargetJobs []string
	Parameters map[string]any
	Cluster    *string
}

// Run starts a simulation scenario. Returns the created run immediately;
// the scenario executes in a background goroutine.
func (e *Engine) Run(ctx context.Context, input SimulationInput) (*SimulationRun, error) {
	scenarioFn, ok := scenarioRegistry[input.Scenario]
	if !ok {
		return nil, fmt.Errorf("unknown scenario: %s", input.Scenario)
	}

	e.mu.Lock()
	if e.activeRun != nil {
		e.mu.Unlock()
		return nil, fmt.Errorf("simulation already running: %s (run %d)", e.activeRun.run.Scenario, e.activeRun.run.ID)
	}

	run := &SimulationRun{
		Scenario:   input.Scenario,
		Status:     StatusPending,
		StartedAt:  time.Now(),
		Parameters: input.Parameters,
	}
	if run.Parameters == nil {
		run.Parameters = map[string]any{}
	}

	// Merge target jobs into parameters if provided.
	if len(input.TargetJobs) > 0 {
		run.Parameters["targetJobs"] = input.TargetJobs
	}

	if err := e.store.CreateRun(ctx, run); err != nil {
		e.mu.Unlock()
		return nil, fmt.Errorf("creating simulation run: %w", err)
	}

	runCtx, cancel := context.WithCancel(context.Background())
	e.activeRun = &activeSimulation{run: run, cancel: cancel}
	e.mu.Unlock()

	// Launch scenario in background goroutine.
	go e.executeScenario(runCtx, run, scenarioFn)

	return run, nil
}

func (e *Engine) executeScenario(ctx context.Context, run *SimulationRun, fn ScenarioFunc) {
	// Update status to RUNNING.
	run.Status = StatusRunning
	if err := e.store.UpdateRun(ctx, run); err != nil {
		e.logger.Error("failed to update run status", "run_id", run.ID, "error", err)
	}

	// Execute the scenario.
	err := fn(ctx, e, run)

	now := time.Now()
	run.StoppedAt = &now

	if err != nil {
		if ctx.Err() != nil {
			run.Status = StatusCancelled
		} else {
			run.Status = StatusFailed
			e.logger.Error("simulation failed", "run_id", run.ID, "scenario", run.Scenario, "error", err)
		}
	} else {
		run.Status = StatusCompleted
	}

	if updateErr := e.store.UpdateRun(context.Background(), run); updateErr != nil {
		e.logger.Error("failed to update run status", "run_id", run.ID, "error", updateErr)
	}

	// Clear active run.
	e.mu.Lock()
	e.activeRun = nil
	e.mu.Unlock()

	e.logger.Info("simulation finished", "run_id", run.ID, "status", run.Status)
}

// Stop cancels a running simulation.
func (e *Engine) Stop(ctx context.Context, runID int64) (*SimulationRun, error) {
	e.mu.Lock()
	active := e.activeRun
	e.mu.Unlock()

	if active == nil || active.run.ID != runID {
		return nil, fmt.Errorf("simulation run %d is not currently active", runID)
	}

	active.cancel()

	// Wait briefly for the goroutine to finish and update the DB.
	time.Sleep(100 * time.Millisecond)

	return e.store.GetRun(ctx, runID)
}

// ListRuns returns all simulation runs.
func (e *Engine) ListRuns(ctx context.Context) ([]SimulationRun, error) {
	return e.store.ListRuns(ctx)
}

// GetRun returns a specific simulation run with observations.
func (e *Engine) GetRun(ctx context.Context, runID int64) (*SimulationRun, error) {
	return e.store.GetRun(ctx, runID)
}

// Presets returns all available simulation presets.
func (e *Engine) Presets() []SimulationPreset {
	return presets()
}

// AddObservation records a metric observation for a running simulation.
func (e *Engine) AddObservation(ctx context.Context, runID int64, metric string, value float64, annotation string) error {
	obs := &SimulationObservation{
		RunID:      runID,
		CapturedAt: time.Now(),
		Metric:     metric,
		Value:      value,
		Annotation: annotation,
	}
	return e.store.AddObservation(ctx, obs)
}
