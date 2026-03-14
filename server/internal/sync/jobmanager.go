package sync

import (
	"context"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// runJobManagerSync performs the JM sync loop: initial sync, then tick at interval.
func (s *Syncer) runJobManagerSync(ctx context.Context) {
	s.syncJobManager(ctx)

	ticker := time.NewTicker(s.config.JobManager)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncJobManager(ctx)
		}
	}
}

// syncJobManager fetches job manager config and environment from all clusters and upserts.
func (s *Syncer) syncJobManager(ctx context.Context) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for job manager", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("job_manager", clusterName).Inc()
			continue
		}

		cfg, err := conn.Service.GetJobManagerConfig(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch job manager config failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("job_manager", clusterName).Inc()
			continue
		}

		env, err := conn.Service.GetJobManagerEnvironment(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch job manager environment failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("job_manager", clusterName).Inc()
			continue
		}

		snapshot, err := storage.FromFlinkJobManager(cfg, *env, clusterName)
		if err != nil {
			s.logger.Warn("sync: convert job manager snapshot failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("job_manager", clusterName).Inc()
			continue
		}

		if err := s.stores.JobManager.UpsertJobManager(ctx, snapshot); err != nil {
			s.logger.Warn("sync: upsert job manager failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("job_manager", clusterName).Inc()
			continue
		}

		observability.SyncUpsertsTotal.WithLabelValues("job_manager", clusterName).Add(1)
		observability.SyncDurationSeconds.WithLabelValues("job_manager", clusterName).Observe(time.Since(start).Seconds())

		s.logger.Debug("sync: job manager synced", "cluster", clusterName)
	}
}
