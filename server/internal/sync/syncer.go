// Package sync provides background synchronization of Flink cluster data
// to PostgreSQL. Each domain (jobs, checkpoints, etc.) runs as an independent
// goroutine with its own tick interval.
package sync

import (
	"context"
	"log/slog"
	gosync "sync"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/config"
	"github.com/sandboxws/flink-reactor/apps/server/internal/store"
)

// Syncer orchestrates background sync goroutines for each data domain.
type Syncer struct {
	manager *cluster.Manager
	stores  *store.Stores
	config  config.SyncConfig
	logger  *slog.Logger

	cancel context.CancelFunc
	wg     gosync.WaitGroup
}

// New creates a Syncer that will sync data from the cluster manager to the stores.
func New(manager *cluster.Manager, stores *store.Stores, cfg config.SyncConfig, logger *slog.Logger) *Syncer {
	return &Syncer{
		manager: manager,
		stores:  stores,
		config:  cfg,
		logger:  logger,
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

	s.logger.Info("sync started",
		"jobs_interval", s.config.Jobs,
		"checkpoints_interval", s.config.Checkpoints,
		"exceptions_interval", s.config.Exceptions,
		"task_managers_interval", s.config.TaskManagers,
		"job_manager_interval", s.config.JobManager,
		"logs_interval", s.config.Logs,
		"metrics_interval", s.config.Metrics,
		"cluster_overview_interval", s.config.ClusterOverview,
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
