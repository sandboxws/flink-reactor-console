package sync

import (
	"context"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// runTaskManagerSync performs the TM sync loop: initial sync, then tick at interval.
func (s *Syncer) runTaskManagerSync(ctx context.Context) {
	s.syncTaskManagers(ctx)

	ticker := time.NewTicker(s.config.TaskManagers)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncTaskManagers(ctx)
		}
	}
}

// syncTaskManagers fetches task manager list from all clusters and upserts snapshots.
func (s *Syncer) syncTaskManagers(ctx context.Context) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for task managers", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("task_managers", clusterName).Inc()
			continue
		}

		tmList, err := conn.Service.GetTaskManagers(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch task managers failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("task_managers", clusterName).Inc()
			continue
		}

		if len(tmList.TaskManagers) == 0 {
			observability.SyncDurationSeconds.WithLabelValues("task_managers", clusterName).Observe(time.Since(start).Seconds())
			continue
		}

		snapshots := make([]storage.DBTaskManagerSnapshot, 0, len(tmList.TaskManagers))
		for _, tm := range tmList.TaskManagers {
			snap, err := storage.FromFlinkTaskManager(tm, clusterName)
			if err != nil {
				s.logger.Warn("sync: convert task manager failed", "cluster", clusterName, "tm_id", tm.ID, "error", err)
				continue
			}
			snapshots = append(snapshots, snap)
		}

		if err := s.stores.TaskManagers.UpsertTaskManagers(ctx, snapshots); err != nil {
			s.logger.Warn("sync: upsert task managers failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("task_managers", clusterName).Inc()
			continue
		}

		observability.SyncUpsertsTotal.WithLabelValues("task_managers", clusterName).Add(float64(len(snapshots)))
		observability.SyncDurationSeconds.WithLabelValues("task_managers", clusterName).Observe(time.Since(start).Seconds())

		if len(snapshots) > 0 {
			s.logger.Debug("sync: task managers synced", "cluster", clusterName, "upserted", len(snapshots))
		}
	}
}
