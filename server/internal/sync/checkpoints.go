package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// runCheckpointSync performs the checkpoint sync loop: initial sync, then tick at interval.
func (s *Syncer) runCheckpointSync(ctx context.Context) {
	s.syncCheckpoints(ctx)

	ticker := time.NewTicker(s.config.Checkpoints)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncCheckpoints(ctx)
		}
	}
}

// syncCheckpoints fetches checkpoint statistics from all clusters and upserts them.
func (s *Syncer) syncCheckpoints(ctx context.Context) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for checkpoints", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("checkpoints", clusterName).Inc()
			continue
		}

		// Get active jobs from Flink REST.
		overview, err := conn.Service.GetJobs(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch jobs for checkpoint sync failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("checkpoints", clusterName).Inc()
			continue
		}

		upsertCount := 0
		for _, job := range overview.Jobs {
			if job.State != "RUNNING" {
				continue
			}

			stats, err := conn.Service.GetCheckpointStats(ctx, job.JID)
			if err != nil {
				s.logger.Debug("sync: fetch checkpoints failed", "cluster", clusterName, "jid", job.JID, "error", err)
				continue
			}

			if len(stats.History) == 0 {
				continue
			}

			dbCheckpoints := make([]storage.DBCheckpoint, len(stats.History))
			for i, cp := range stats.History {
				dbCheckpoints[i] = storage.FromFlinkCheckpoint(cp, job.JID, clusterName)
			}

			if err := s.stores.Checkpoints.UpsertCheckpoints(ctx, dbCheckpoints); err != nil {
				s.logger.Warn("sync: upsert checkpoints failed", "cluster", clusterName, "jid", job.JID, "error", err)
				observability.SyncErrorsTotal.WithLabelValues("checkpoints", clusterName).Inc()
				continue
			}
			upsertCount += len(dbCheckpoints)
		}

		observability.SyncUpsertsTotal.WithLabelValues("checkpoints", clusterName).Add(float64(upsertCount))
		observability.SyncDurationSeconds.WithLabelValues("checkpoints", clusterName).Observe(time.Since(start).Seconds())

		if upsertCount > 0 {
			s.logger.Debug("sync: checkpoints synced", "cluster", clusterName, "upserted", upsertCount)
		}
	}
}

// syncJobCheckpoints fetches and upserts checkpoints for a single job.
// Used by the job sync to capture checkpoint state on terminal transitions.
func (s *Syncer) syncJobCheckpoints(ctx context.Context, clusterName, jid string) error {
	conn, err := s.manager.Get(clusterName)
	if err != nil {
		return fmt.Errorf("resolve cluster: %w", err)
	}

	stats, err := conn.Service.GetCheckpointStats(ctx, jid)
	if err != nil {
		return fmt.Errorf("fetch checkpoint stats: %w", err)
	}

	if len(stats.History) == 0 {
		return nil
	}

	dbCheckpoints := make([]storage.DBCheckpoint, len(stats.History))
	for i, cp := range stats.History {
		dbCheckpoints[i] = storage.FromFlinkCheckpoint(cp, jid, clusterName)
	}

	return s.stores.Checkpoints.UpsertCheckpoints(ctx, dbCheckpoints)
}
