package sync

import (
	"context"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

const defaultLogName = "default"

// runLogSync performs the log sync loop: initial sync, then tick at interval.
func (s *Syncer) runLogSync(ctx context.Context) {
	s.syncLogs(ctx)

	ticker := time.NewTicker(s.config.Logs)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncLogs(ctx)
		}
	}
}

// syncLogs fetches log content from job manager and all task managers,
// upserting only when the log has grown beyond the stored byte offset.
func (s *Syncer) syncLogs(ctx context.Context) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for logs", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("logs", clusterName).Inc()
			continue
		}

		client := conn.Service.Client()
		var upserted int

		// Sync job manager log.
		if n := s.syncLogSource(ctx, client, clusterName, "jobmanager", "jobmanager", "/jobmanager/log"); n > 0 {
			upserted += n
		}

		// Sync task manager logs.
		tmList, err := conn.Service.GetTaskManagers(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch task managers for logs failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("logs", clusterName).Inc()
		} else {
			for _, tm := range tmList.TaskManagers {
				if n := s.syncLogSource(ctx, client, clusterName, "taskmanager", tm.ID, "/taskmanagers/"+tm.ID+"/log"); n > 0 {
					upserted += n
				}
			}
		}

		observability.SyncDurationSeconds.WithLabelValues("logs", clusterName).Observe(time.Since(start).Seconds())

		if upserted > 0 {
			observability.SyncUpsertsTotal.WithLabelValues("logs", clusterName).Add(float64(upserted))
			s.logger.Debug("sync: logs synced", "cluster", clusterName, "upserted", upserted)
		}
	}
}

// syncLogSource fetches a single log, compares length to stored offset, and upserts if grown.
// Returns 1 if upserted, 0 otherwise.
func (s *Syncer) syncLogSource(ctx context.Context, client interface{ GetText(context.Context, string) (string, error) }, clusterName, sourceType, sourceID, path string) int {
	content, err := client.GetText(ctx, path)
	if err != nil {
		s.logger.Warn("sync: fetch log failed", "cluster", clusterName, "source_type", sourceType, "source_id", sourceID, "error", err)
		observability.SyncErrorsTotal.WithLabelValues("logs", clusterName).Inc()
		return 0
	}

	newLen := int64(len(content))

	// Check stored offset to avoid unnecessary writes.
	storedOffset, err := s.stores.Logs.GetLogOffset(ctx, clusterName, sourceType, sourceID, defaultLogName)
	if err != nil {
		s.logger.Warn("sync: get log offset failed", "cluster", clusterName, "source_type", sourceType, "source_id", sourceID, "error", err)
		observability.SyncErrorsTotal.WithLabelValues("logs", clusterName).Inc()
		return 0
	}

	if newLen <= storedOffset {
		return 0
	}

	log := storage.DBLog{
		Cluster:    clusterName,
		SourceType: sourceType,
		SourceID:   sourceID,
		LogFile:    defaultLogName,
		Content:    content,
		ByteOffset: newLen,
	}

	if err := s.stores.Logs.UpsertLog(ctx, log); err != nil {
		s.logger.Warn("sync: upsert log failed", "cluster", clusterName, "source_type", sourceType, "source_id", sourceID, "error", err)
		observability.SyncErrorsTotal.WithLabelValues("logs", clusterName).Inc()
		return 0
	}

	return 1
}
