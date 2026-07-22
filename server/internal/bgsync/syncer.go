// Package bgsync provides background synchronization of Flink cluster data
// to PostgreSQL. Each domain (jobs, checkpoints, etc.) runs as an independent
// goroutine with its own tick interval.
package bgsync

import (
	"context"
	"log/slog"
	"sync"

	"github.com/sandboxws/flink-reactor-console/server/internal/cluster"
	"github.com/sandboxws/flink-reactor-console/server/internal/config"
	"github.com/sandboxws/flink-reactor-console/server/internal/store"
)

// Syncer orchestrates background sync goroutines for each data domain.
type Syncer struct {
	manager *cluster.Manager
	stores  *store.Stores
	config  config.SyncConfig
	logger  *slog.Logger

	cancel context.CancelFunc
	wg     sync.WaitGroup

	// TM churn tracking: last-seen TaskManager id set per cluster, used to
	// detect id-level replacement (an OOMKilled TM vanishing while a new one
	// appears) even when the aggregate count stays flat.
	churnMu   sync.Mutex
	lastTMIDs map[string]map[string]struct{}
}

// New creates a Syncer that will sync data from the cluster manager to the stores.
func New(manager *cluster.Manager, stores *store.Stores, cfg config.SyncConfig, logger *slog.Logger) *Syncer {
	return &Syncer{
		manager:   manager,
		stores:    stores,
		config:    cfg,
		logger:    logger,
		lastTMIDs: make(map[string]map[string]struct{}),
	}
}

// Start spawns per-domain sync goroutines. Each goroutine performs an initial
// sync immediately, then ticks at the configured interval. Call Stop to shut
// down all goroutines.
func (s *Syncer) Start(ctx context.Context) {
	ctx, s.cancel = context.WithCancel(ctx)

	// Jobs domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runJobSync(ctx)
	}()

	// Checkpoints domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runCheckpointSync(ctx)
	}()

	// Exceptions domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runExceptionSync(ctx)
	}()

	// Task managers domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runTaskManagerSync(ctx)
	}()

	// Job manager domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runJobManagerSync(ctx)
	}()

	// Metrics domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runMetricsSync(ctx)
	}()

	// Logs domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runLogSync(ctx)
	}()

	// Cluster overview domain.
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runOverviewSync(ctx)
	}()

	// Restore-outcome domain (state-collision feedback loop).
	s.wg.Add(1)
	go func() {
		defer s.wg.Done()
		s.runRestoreSync(ctx)
	}()

	s.logger.Info(
		"sync started",
		"jobs_interval", s.config.Jobs,
		"checkpoints_interval", s.config.Checkpoints,
		"exceptions_interval", s.config.Exceptions,
		"task_managers_interval", s.config.TaskManagers,
		"job_manager_interval", s.config.JobManager,
		"logs_interval", s.config.Logs,
		"metrics_interval", s.config.Metrics,
		"cluster_overview_interval", s.config.ClusterOverview,
		"restores_interval", s.config.Restores,
	)
}

// Stop cancels all sync goroutines and waits for them to finish.
func (s *Syncer) Stop() {
	if s.cancel != nil {
		s.cancel()
	}
	s.wg.Wait()
	s.logger.Info("sync stopped")
}
