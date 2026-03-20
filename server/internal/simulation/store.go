// Package simulation provides a chaos engineering simulation engine
// for stress-testing Flink pipelines and collecting benchmark observations.
package simulation

import (
	"context"
	"encoding/json"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// SimulationStatus represents the lifecycle state of a simulation run.
type SimulationStatus string

const (
	StatusPending   SimulationStatus = "PENDING"
	StatusRunning   SimulationStatus = "RUNNING"
	StatusCompleted SimulationStatus = "COMPLETED"
	StatusFailed    SimulationStatus = "FAILED"
	StatusCancelled SimulationStatus = "CANCELLED"
)

// SimulationRun represents a single execution of a simulation scenario.
type SimulationRun struct {
	ID           int64
	Scenario     string
	Status       SimulationStatus
	StartedAt    time.Time
	StoppedAt    *time.Time
	Parameters   map[string]any
	Observations []SimulationObservation
}

// SimulationObservation is a timestamped metric captured during a simulation.
type SimulationObservation struct {
	ID         int64
	RunID      int64
	CapturedAt time.Time
	Metric     string
	Value      float64
	Annotation string
}

// Store handles PostgreSQL persistence for simulation runs and observations.
type Store struct {
	pool *pgxpool.Pool
}

// NewStore creates a new simulation store.
func NewStore(pool *pgxpool.Pool) *Store {
	return &Store{pool: pool}
}

// CreateRun inserts a new simulation run and sets the generated ID on the run.
func (s *Store) CreateRun(ctx context.Context, run *SimulationRun) error {
	params, err := json.Marshal(run.Parameters)
	if err != nil {
		return err
	}

	return s.pool.QueryRow(ctx,
		`INSERT INTO simulation_runs (scenario, status, started_at, parameters)
		 VALUES ($1, $2, $3, $4)
		 RETURNING id`,
		run.Scenario, string(run.Status), run.StartedAt, params,
	).Scan(&run.ID)
}

// UpdateRun updates the status and stopped_at timestamp of a run.
func (s *Store) UpdateRun(ctx context.Context, run *SimulationRun) error {
	_, err := s.pool.Exec(ctx,
		`UPDATE simulation_runs SET status = $1, stopped_at = $2 WHERE id = $3`,
		string(run.Status), run.StoppedAt, run.ID,
	)
	return err
}

// GetRun retrieves a simulation run by ID with its observations.
func (s *Store) GetRun(ctx context.Context, id int64) (*SimulationRun, error) {
	run := &SimulationRun{}
	var params []byte

	err := s.pool.QueryRow(ctx,
		`SELECT id, scenario, status, started_at, stopped_at, parameters
		 FROM simulation_runs WHERE id = $1`, id,
	).Scan(&run.ID, &run.Scenario, &run.Status, &run.StartedAt, &run.StoppedAt, &params)
	if err != nil {
		return nil, err
	}

	if err := json.Unmarshal(params, &run.Parameters); err != nil {
		run.Parameters = map[string]any{}
	}

	obs, err := s.GetObservations(ctx, id)
	if err != nil {
		return nil, err
	}
	run.Observations = obs

	return run, nil
}

// ListRuns returns all simulation runs ordered by start time (most recent first).
func (s *Store) ListRuns(ctx context.Context) ([]SimulationRun, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, scenario, status, started_at, stopped_at, parameters
		 FROM simulation_runs ORDER BY started_at DESC`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var runs []SimulationRun
	for rows.Next() {
		var run SimulationRun
		var params []byte
		if err := rows.Scan(&run.ID, &run.Scenario, &run.Status, &run.StartedAt, &run.StoppedAt, &params); err != nil {
			return nil, err
		}
		if err := json.Unmarshal(params, &run.Parameters); err != nil {
			run.Parameters = map[string]any{}
		}
		runs = append(runs, run)
	}
	return runs, rows.Err()
}

// AddObservation inserts a metric observation for a simulation run.
func (s *Store) AddObservation(ctx context.Context, obs *SimulationObservation) error {
	return s.pool.QueryRow(ctx,
		`INSERT INTO simulation_observations (run_id, captured_at, metric, value, annotation)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id`,
		obs.RunID, obs.CapturedAt, obs.Metric, obs.Value, obs.Annotation,
	).Scan(&obs.ID)
}

// GetObservations returns all observations for a run, ordered by capture time.
func (s *Store) GetObservations(ctx context.Context, runID int64) ([]SimulationObservation, error) {
	rows, err := s.pool.Query(ctx,
		`SELECT id, run_id, captured_at, metric, value, COALESCE(annotation, '')
		 FROM simulation_observations WHERE run_id = $1 ORDER BY captured_at`, runID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var obs []SimulationObservation
	for rows.Next() {
		var o SimulationObservation
		if err := rows.Scan(&o.ID, &o.RunID, &o.CapturedAt, &o.Metric, &o.Value, &o.Annotation); err != nil {
			return nil, err
		}
		obs = append(obs, o)
	}
	return obs, rows.Err()
}
