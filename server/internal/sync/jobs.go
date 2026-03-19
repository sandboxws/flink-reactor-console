package sync

import (
	"context"
	"encoding/json"
	"fmt"
	gosync "sync"
	"time"

	"golang.org/x/sync/errgroup"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// terminalStates are Flink job states that indicate the job has completed.
var terminalStates = map[string]bool{
	"FINISHED": true,
	"FAILED":   true,
	"CANCELED": true,
}

// jobTracker tracks known job states across sync ticks for a single cluster.
type jobTracker struct {
	mu     gosync.Mutex
	states map[string]string // jobID → last known state
}

func newJobTracker() *jobTracker {
	return &jobTracker{states: make(map[string]string)}
}

// runJobSync performs the job sync loop: initial sync, then tick at interval.
func (s *Syncer) runJobSync(ctx context.Context) {
	// Per-cluster trackers.
	trackers := make(map[string]*jobTracker)

	// Initial sync.
	s.syncJobs(ctx, trackers)

	ticker := time.NewTicker(s.config.Jobs)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncJobs(ctx, trackers)
		}
	}
}

// syncJobs fetches job overviews from all clusters and upserts them.
func (s *Syncer) syncJobs(ctx context.Context, trackers map[string]*jobTracker) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("jobs", clusterName).Inc()
			continue
		}

		if err := s.syncClusterJobs(ctx, conn, clusterName, trackers); err != nil {
			s.logger.Warn("sync: job sync failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("jobs", clusterName).Inc()
		}

		observability.SyncDurationSeconds.WithLabelValues("jobs", clusterName).Observe(time.Since(start).Seconds())
	}
}

// syncClusterJobs handles job sync for a single cluster.
func (s *Syncer) syncClusterJobs(ctx context.Context, conn *cluster.Connection, clusterName string, trackers map[string]*jobTracker) error {
	// Upsert cluster record.
	if err := s.stores.Clusters.UpsertCluster(ctx, storage.DBCluster{
		Name:      clusterName,
		URL:       conn.URL,
		IsDefault: false,
	}); err != nil {
		return fmt.Errorf("upsert cluster: %w", err)
	}

	// Fetch job overview from Flink REST.
	overview, err := conn.Service.GetJobs(ctx)
	if err != nil {
		return fmt.Errorf("fetch jobs overview: %w", err)
	}

	tracker := trackers[clusterName]
	if tracker == nil {
		tracker = newJobTracker()
		trackers[clusterName] = tracker
	}

	// Identify jobs needing detail fetches.
	type detailJob struct {
		job    flink.JobOverview
		reason string // "new" or "terminal"
	}
	var needDetail []detailJob

	for _, job := range overview.Jobs {
		tracker.mu.Lock()
		prevState, known := tracker.states[job.JID]
		tracker.states[job.JID] = job.State
		tracker.mu.Unlock()

		if !known && terminalStates[job.State] {
			// First seen and already completed: archive with full snapshot.
			needDetail = append(needDetail, detailJob{job: job, reason: "terminal"})
		} else if !known {
			// New running job: fetch detail for vertices.
			needDetail = append(needDetail, detailJob{job: job, reason: "new"})
		} else if prevState != job.State && terminalStates[job.State] {
			// Terminal state transition: archive complete state.
			needDetail = append(needDetail, detailJob{job: job, reason: "terminal"})
		}
	}

	// Upsert all jobs from overview.
	upsertCount := 0
	for _, job := range overview.Jobs {
		dbJob := storage.FromFlinkJobOverview(job, clusterName)
		if err := s.stores.Jobs.UpsertJob(ctx, dbJob); err != nil {
			s.logger.Warn("sync: upsert job failed", "cluster", clusterName, "jid", job.JID, "error", err)
			continue
		}
		upsertCount++
	}
	observability.SyncUpsertsTotal.WithLabelValues("jobs", clusterName).Add(float64(upsertCount))

	// Fetch details concurrently for new/terminal jobs.
	if len(needDetail) > 0 {
		g, gctx := errgroup.WithContext(ctx)
		g.SetLimit(10)

		for _, dj := range needDetail {
			dj := dj
			g.Go(func() error {
				return s.fetchAndUpsertJobDetail(gctx, conn, clusterName, dj.job, dj.reason == "terminal")
			})
		}

		if err := g.Wait(); err != nil {
			s.logger.Warn("sync: detail fetch errors", "cluster", clusterName, "error", err)
		}
	}

	return nil
}

// fetchAndUpsertJobDetail fetches full job detail and upserts vertices.
// When isTerminal is true, it also captures a JSONB snapshot of the full
// aggregate and syncs checkpoints/exceptions for historical viewing.
func (s *Syncer) fetchAndUpsertJobDetail(ctx context.Context, conn *cluster.Connection, clusterName string, job flink.JobOverview, isTerminal bool) error {
	detail, err := conn.Service.GetJobDetail(ctx, job.JID)
	if err != nil {
		return fmt.Errorf("fetch detail for %s: %w", job.JID, err)
	}

	// Upsert vertices from the job detail.
	if detail.Job != nil && len(detail.Job.Vertices) > 0 {
		vertices := make([]storage.DBVertex, len(detail.Job.Vertices))
		for i, v := range detail.Job.Vertices {
			vertices[i] = storage.FromFlinkVertex(v, job.JID, clusterName)
		}
		if err := s.stores.Jobs.UpsertVertices(ctx, vertices); err != nil {
			s.logger.Warn("sync: upsert vertices failed", "cluster", clusterName, "jid", job.JID, "error", err)
		} else {
			observability.SyncUpsertsTotal.WithLabelValues("vertices", clusterName).Add(float64(len(vertices)))
		}
	}

	// On terminal state: capture full snapshot + sync checkpoints & exceptions.
	if isTerminal {
		snapshotJSON, err := json.Marshal(detail)
		if err != nil {
			s.logger.Warn("sync: marshal job snapshot failed", "cluster", clusterName, "jid", job.JID, "error", err)
		} else {
			if err := s.stores.Jobs.UpsertJobSnapshot(ctx, job.JID, clusterName, snapshotJSON); err != nil {
				s.logger.Warn("sync: upsert job snapshot failed", "cluster", clusterName, "jid", job.JID, "error", err)
			}
		}

		if err := s.syncJobCheckpoints(ctx, clusterName, job.JID); err != nil {
			s.logger.Warn("sync: terminal checkpoint sync failed", "cluster", clusterName, "jid", job.JID, "error", err)
		}
		if err := s.syncJobExceptions(ctx, clusterName, job.JID); err != nil {
			s.logger.Warn("sync: terminal exception sync failed", "cluster", clusterName, "jid", job.JID, "error", err)
		}
	}

	return nil
}
