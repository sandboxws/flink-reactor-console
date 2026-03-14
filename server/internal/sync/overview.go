package sync

import (
	"context"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// runOverviewSync performs the overview sync loop: initial sync, then tick at interval.
func (s *Syncer) runOverviewSync(ctx context.Context) {
	s.syncOverview(ctx)

	ticker := time.NewTicker(s.config.ClusterOverview)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncOverview(ctx)
		}
	}
}

// syncOverview fetches cluster overview from all clusters and inserts snapshots.
func (s *Syncer) syncOverview(ctx context.Context) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for overview", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("cluster_overview", clusterName).Inc()
			continue
		}

		overview, err := conn.Service.GetClusterOverview(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch cluster overview failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("cluster_overview", clusterName).Inc()
			continue
		}

		snapshot := storage.FromFlinkClusterOverview(*overview, clusterName)

		if err := s.stores.Metrics.InsertOverviewSnapshot(ctx, snapshot); err != nil {
			s.logger.Warn("sync: insert overview snapshot failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("cluster_overview", clusterName).Inc()
			continue
		}

		observability.SyncUpsertsTotal.WithLabelValues("cluster_overview", clusterName).Add(1)
		observability.SyncDurationSeconds.WithLabelValues("cluster_overview", clusterName).Observe(time.Since(start).Seconds())

		s.logger.Debug("sync: cluster overview synced", "cluster", clusterName)
	}
}
