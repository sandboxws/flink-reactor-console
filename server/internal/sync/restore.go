package sync

import (
	"context"
	"encoding/json"
	"strconv"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
	"github.com/sandboxws/flink-reactor/apps/server/internal/store"
)

// defaultRestoreEnvironment scopes restore tracking to the same environment the
// CLI ingest defaults to (manifests.DefaultEnvironment). Kept as a local const
// to avoid importing the manifests package from the sync layer.
const defaultRestoreEnvironment = "default"

// defaultRestoreInterval is used when storage.sync.restores is unset/zero,
// since time.NewTicker panics on a non-positive duration.
const defaultRestoreInterval = 60 * time.Second

// recentExceptionScan bounds how many recent exceptions per job the restore
// loop inspects for restore-failure signatures.
const recentExceptionScan = 25

// runRestoreSync observes restore outcomes: for each tracked pipeline's job it
// records whether restoring from a checkpoint/savepoint succeeded or failed
// (and why). The `seen` set lives for the goroutine's lifetime so a given
// restore is processed once per process; RestoreEventExists guards restarts.
func (s *Syncer) runRestoreSync(ctx context.Context) {
	seen := make(map[string]struct{})
	s.syncRestores(ctx, seen)

	interval := s.config.Restores
	if interval <= 0 {
		interval = defaultRestoreInterval
	}
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncRestores(ctx, seen)
		}
	}
}

// syncRestores walks every cluster's jobs, attributes each to a tracked
// pipeline (a job whose name has a stored State Manifest), and records the
// observed restore outcome.
func (s *Syncer) syncRestores(ctx context.Context, seen map[string]struct{}) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for restores", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("restores", clusterName).Inc()
			continue
		}

		overview, err := conn.Service.GetJobs(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch jobs for restore sync failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("restores", clusterName).Inc()
			continue
		}

		for _, job := range overview.Jobs {
			// Attribute the job to a pipeline by name. The guard scopes restore
			// tracking to FlinkReactor-managed pipelines and yields the manifest
			// id to attach. (bluegreen_name correlation via the k8s watcher is a
			// follow-up — see change-03 tasks.)
			latest, err := s.stores.PipelineManifests.Latest(ctx, job.Name, defaultRestoreEnvironment)
			if err != nil {
				s.logger.Debug("sync: latest manifest lookup failed", "cluster", clusterName, "pipeline", job.Name, "error", err)
				continue
			}
			if latest == nil {
				continue // not a tracked pipeline
			}
			manifestID := latest.ID

			switch job.State {
			case "RUNNING":
				s.recordRestoreSuccess(ctx, conn, clusterName, job.JID, job.Name, manifestID, seen)
			case "FAILED", "FAILING", "RESTARTING", "RECONCILING":
				s.recordRestoreFailure(ctx, clusterName, job.JID, job.Name, manifestID, seen)
			}
		}

		observability.SyncDurationSeconds.WithLabelValues("restores", clusterName).Observe(time.Since(start).Seconds())
	}
}

// recordRestoreSuccess records a SUCCESS event when a RUNNING job is running
// off restored state (Latest.Restored is set).
func (s *Syncer) recordRestoreSuccess(
	ctx context.Context,
	conn *cluster.Connection,
	clusterName, jid, pipeline string,
	manifestID int64,
	seen map[string]struct{},
) {
	stats, err := conn.Service.GetCheckpointStats(ctx, jid)
	if err != nil || stats.Latest == nil || stats.Latest.Restored == nil {
		return
	}
	r := stats.Latest.Restored
	key := "ok|" + clusterName + "|" + jid + "|" + strconv.FormatInt(r.ID, 10)
	if _, ok := seen[key]; ok {
		return
	}

	checkpointID := r.ID
	detail, _ := json.Marshal(map[string]any{
		"is_savepoint":      r.IsSavepoint,
		"restore_timestamp": r.RestoreTimestamp,
	})
	ev := storage.DBRestoreEvent{
		PipelineName:         pipeline,
		Environment:          defaultRestoreEnvironment,
		Cluster:              clusterName,
		JID:                  &jid,
		ManifestID:           &manifestID,
		Outcome:              "SUCCESS",
		RestoredCheckpointID: &checkpointID,
		RestoredPath:         r.ExternalPath,
		Detail:               detail,
	}
	s.persistRestore(ctx, key, seen, ev, &checkpointID, nil)
}

// recordRestoreFailure records a FAILED event when a non-running job carries a
// recent exception whose text matches a restore-failure signature.
func (s *Syncer) recordRestoreFailure(
	ctx context.Context,
	clusterName, jid, pipeline string,
	manifestID int64,
	seen map[string]struct{},
) {
	exs, _, err := s.stores.Exceptions.QueryExceptions(ctx,
		store.ExceptionFilter{ClusterID: &clusterName, JobID: &jid},
		store.CursorPagination{First: recentExceptionScan},
	)
	if err != nil {
		s.logger.Debug("sync: query exceptions for restore failure failed", "cluster", clusterName, "jid", jid, "error", err)
		return
	}

	for i := range exs {
		ex := exs[i]
		category, isFailure := CategorizeRestoreFailure(ex.ExceptionName + "\n" + ex.Stacktrace)
		if !isFailure {
			continue
		}
		key := "fail|" + clusterName + "|" + jid + "|" + strconv.FormatInt(ex.ID, 10)
		if _, ok := seen[key]; ok {
			return // already recorded this failure
		}
		exceptionID := ex.ID
		cat := category
		detail, _ := json.Marshal(map[string]any{"exception_name": ex.ExceptionName})
		ev := storage.DBRestoreEvent{
			PipelineName:  pipeline,
			Environment:   defaultRestoreEnvironment,
			Cluster:       clusterName,
			JID:           &jid,
			ManifestID:    &manifestID,
			Outcome:       "FAILED",
			ErrorCategory: &cat,
			ExceptionID:   &exceptionID,
			Detail:        detail,
		}
		s.persistRestore(ctx, key, seen, ev, nil, &exceptionID)
		return // one failure event per job per pass
	}
}

// persistRestore applies the dedup chain — in-memory seen set, then a DB
// existence check for restart-safety — before inserting and marking seen.
func (s *Syncer) persistRestore(
	ctx context.Context,
	key string,
	seen map[string]struct{},
	ev storage.DBRestoreEvent,
	restoredCheckpointID, exceptionID *int64,
) {
	if _, ok := seen[key]; ok {
		return
	}
	exists, err := s.stores.PipelineManifests.RestoreEventExists(ctx, ev.Cluster, *ev.JID, restoredCheckpointID, exceptionID)
	if err != nil {
		s.logger.Warn("sync: restore event existence check failed", "cluster", ev.Cluster, "jid", *ev.JID, "error", err)
		return
	}
	if exists {
		seen[key] = struct{}{}
		return
	}
	if _, err := s.stores.PipelineManifests.InsertRestoreEvent(ctx, ev); err != nil {
		s.logger.Warn("sync: insert restore event failed", "cluster", ev.Cluster, "jid", *ev.JID, "error", err)
		observability.SyncErrorsTotal.WithLabelValues("restores", ev.Cluster).Inc()
		return
	}
	seen[key] = struct{}{}
	observability.SyncUpsertsTotal.WithLabelValues("restores", ev.Cluster).Inc()

	category := ""
	if ev.ErrorCategory != nil {
		category = *ev.ErrorCategory
	}
	s.logger.Info("sync: restore event recorded",
		"pipeline", ev.PipelineName, "cluster", ev.Cluster, "jid", *ev.JID,
		"outcome", ev.Outcome, "category", category)
}
