package bgsync

import (
	"context"
	"time"

	"github.com/sandboxws/flink-reactor-console/server/internal/observability"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
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

		// Record id-level churn (replacement even when the count is flat).
		current := make(map[string]struct{}, len(tmList.TaskManagers))
		for _, tm := range tmList.TaskManagers {
			current[tm.ID] = struct{}{}
		}
		s.recordTMChurn(ctx, clusterName, current)

		observability.SyncUpsertsTotal.WithLabelValues("task_managers", clusterName).Add(float64(len(snapshots)))
		observability.SyncDurationSeconds.WithLabelValues("task_managers", clusterName).Observe(time.Since(start).Seconds())

		if len(snapshots) > 0 {
			s.logger.Debug("sync: task managers synced", "cluster", clusterName, "upserted", len(snapshots))
		}
	}
}

// recordTMChurn compares the current TaskManager id set for a cluster against
// the previous observation and persists the number of ids that appeared or
// disappeared as a "taskManagerChurn" cluster metric. The first observation for
// a cluster only seeds the baseline (no data point), so churn is never
// spuriously high right after a server restart. An OOMKilled TM replaced by a
// fresh one shows up here as churn even though the aggregate count is unchanged.
func (s *Syncer) recordTMChurn(ctx context.Context, cluster string, current map[string]struct{}) {
	s.churnMu.Lock()
	prev, seen := s.lastTMIDs[cluster]
	s.lastTMIDs[cluster] = current
	s.churnMu.Unlock()

	if !seen {
		return
	}

	metric := storage.DBMetric{
		Cluster:    cluster,
		SourceType: "cluster",
		SourceID:   cluster,
		MetricID:   "taskManagerChurn",
		Value:      float64(countChurn(prev, current)),
		CapturedAt: time.Now().UTC(),
	}
	if err := s.stores.Metrics.InsertMetrics(ctx, []storage.DBMetric{metric}); err != nil {
		s.logger.Warn("sync: insert TM churn failed", "cluster", cluster, "error", err)
	}
}

// countChurn returns how many ids appeared or disappeared between two
// TaskManager id sets. A replacement (one id gone, one new) counts as 2 even
// though the set size is unchanged — which is exactly the OOMKill-then-restart
// signal a flat count misses.
func countChurn(prev, current map[string]struct{}) int {
	churn := 0
	for id := range current {
		if _, ok := prev[id]; !ok {
			churn++ // appeared
		}
	}
	for id := range prev {
		if _, ok := current[id]; !ok {
			churn++ // gone (e.g. OOMKilled)
		}
	}
	return churn
}
