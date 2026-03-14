// Package store provides typed sub-store access for the reactor-server
// historical data layer. Each domain (clusters, jobs, etc.) has its own
// file with query methods; the Stores aggregate wires them together.
package store

import (
	"github.com/jackc/pgx/v5/pgxpool"
)

// Stores is the top-level aggregate that holds all domain-specific sub-stores
// and the shared connection pool.
type Stores struct {
	pool         *pgxpool.Pool
	Clusters     *ClusterStore
	Jobs         *JobStore
	Checkpoints  *CheckpointStore
	Exceptions   *ExceptionStore
	TaskManagers *TaskManagerStore
	JobManager   *JobManagerStore
	Metrics      *MetricStore
	Logs         *LogStore
}

// New creates a Stores aggregate backed by the given connection pool.
func New(pool *pgxpool.Pool) *Stores {
	return &Stores{
		pool:         pool,
		Clusters:     &ClusterStore{pool: pool},
		Jobs:         &JobStore{pool: pool},
		Checkpoints:  &CheckpointStore{pool: pool},
		Exceptions:   &ExceptionStore{pool: pool},
		TaskManagers: &TaskManagerStore{pool: pool},
		JobManager:   &JobManagerStore{pool: pool},
		Metrics:      &MetricStore{pool: pool},
		Logs:         &LogStore{pool: pool},
	}
}
