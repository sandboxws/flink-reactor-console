package sync

import (
	"context"
	"fmt"
	gosync "sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// runMetricsSync performs the metrics sync loop: initial sync, then tick at interval.
func (s *Syncer) runMetricsSync(ctx context.Context) {
	s.syncMetrics(ctx)

	ticker := time.NewTicker(s.config.Metrics)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncMetrics(ctx)
		}
	}
}

// syncMetrics fetches metrics from job manager, task managers, and active job
// vertices for all clusters, then batch-inserts them.
func (s *Syncer) syncMetrics(ctx context.Context) {
	// Ensure partitions exist before inserting.
	if err := s.stores.Metrics.EnsureCurrentPartitions(ctx); err != nil {
		s.logger.Warn("sync: ensure metric partitions failed", "error", err)
	}

	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for metrics", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("metrics", clusterName).Inc()
			continue
		}

		metrics, err := s.collectClusterMetrics(ctx, conn.Service, clusterName)
		if err != nil {
			s.logger.Warn("sync: collect metrics failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("metrics", clusterName).Inc()
			continue
		}

		if len(metrics) == 0 {
			observability.SyncDurationSeconds.WithLabelValues("metrics", clusterName).Observe(time.Since(start).Seconds())
			continue
		}

		if err := s.stores.Metrics.InsertMetrics(ctx, metrics); err != nil {
			s.logger.Warn("sync: insert metrics failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("metrics", clusterName).Inc()
			continue
		}

		observability.SyncUpsertsTotal.WithLabelValues("metrics", clusterName).Add(float64(len(metrics)))
		observability.SyncDurationSeconds.WithLabelValues("metrics", clusterName).Observe(time.Since(start).Seconds())

		s.logger.Debug("sync: metrics synced", "cluster", clusterName, "count", len(metrics))
	}
}

// collectClusterMetrics fetches metrics from JM, all TMs, and all active vertex
// sources concurrently, returning a unified slice of DBMetric.
func (s *Syncer) collectClusterMetrics(ctx context.Context, svc *flink.Service, cluster string) ([]storage.DBMetric, error) {
	var (
		mu         gosync.Mutex
		allMetrics []storage.DBMetric
	)

	g, gctx := errgroup.WithContext(ctx)
	g.SetLimit(10)

	// Job manager metrics.
	g.Go(func() error {
		items, err := svc.GetJobManagerMetrics(gctx)
		if err != nil {
			s.logger.Debug("sync: fetch JM metrics failed", "cluster", cluster, "error", err)
			return nil // non-fatal
		}
		dbMetrics := make([]storage.DBMetric, 0, len(items))
		for _, m := range items {
			dbMetrics = append(dbMetrics, storage.FromFlinkMetricItem(m, "job_manager", "jobmanager", cluster))
		}
		mu.Lock()
		allMetrics = append(allMetrics, dbMetrics...)
		mu.Unlock()
		return nil
	})

	// Task manager metrics.
	g.Go(func() error {
		tmList, err := svc.GetTaskManagers(gctx)
		if err != nil {
			s.logger.Debug("sync: fetch TM list for metrics failed", "cluster", cluster, "error", err)
			return nil // non-fatal
		}

		tmGroup := new(errgroup.Group)
		tmGroup.SetLimit(10)

		for _, tm := range tmList.TaskManagers {
			tmID := tm.ID
			tmGroup.Go(func() error {
				items, err := svc.GetTaskManagerMetrics(gctx, tmID)
				if err != nil {
					s.logger.Debug("sync: fetch TM metrics failed", "cluster", cluster, "tm_id", tmID, "error", err)
					return nil
				}
				dbMetrics := make([]storage.DBMetric, 0, len(items))
				for _, m := range items {
					dbMetrics = append(dbMetrics, storage.FromFlinkMetricItem(m, "task_manager", tmID, cluster))
				}
				mu.Lock()
				allMetrics = append(allMetrics, dbMetrics...)
				mu.Unlock()
				return nil
			})
		}
		return tmGroup.Wait()
	})

	// Vertex metrics from active (RUNNING) jobs.
	g.Go(func() error {
		jobs, err := svc.GetJobs(gctx)
		if err != nil {
			s.logger.Debug("sync: fetch jobs for vertex metrics failed", "cluster", cluster, "error", err)
			return nil
		}

		vertexGroup := new(errgroup.Group)
		vertexGroup.SetLimit(10)

		for _, job := range jobs.Jobs {
			if job.State != "RUNNING" {
				continue
			}
			jobID := job.JID

			// Fetch job detail to get vertex IDs.
			vertexGroup.Go(func() error {
				var detail flink.JobDetail
				if err := svc.Client().GetJSON(gctx, fmt.Sprintf("/jobs/%s", jobID), &detail); err != nil {
					s.logger.Debug("sync: fetch job detail for vertex metrics failed", "cluster", cluster, "jid", jobID, "error", err)
					return nil
				}

				vGroup := new(errgroup.Group)
				vGroup.SetLimit(5)

				for _, v := range detail.Vertices {
					if v.Status != "RUNNING" {
						continue
					}
					vertexID := v.ID
					vGroup.Go(func() error {
						items, err := svc.GetVertexMetrics(gctx, jobID, vertexID)
						if err != nil {
							s.logger.Debug("sync: fetch vertex metrics failed", "cluster", cluster, "jid", jobID, "vertex", vertexID, "error", err)
							return nil
						}
						dbMetrics := make([]storage.DBMetric, 0, len(items))
						for _, m := range items {
							dbMetrics = append(dbMetrics, storage.FromFlinkMetricItem(m, "vertex", vertexID, cluster))
						}
						mu.Lock()
						allMetrics = append(allMetrics, dbMetrics...)
						mu.Unlock()
						return nil
					})
				}
				return vGroup.Wait()
			})
		}
		return vertexGroup.Wait()
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("collect metrics: %w", err)
	}

	return allMetrics, nil
}
