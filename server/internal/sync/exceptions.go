package sync

import (
	"context"
	"fmt"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// runExceptionSync performs the exception sync loop: initial sync, then tick at interval.
func (s *Syncer) runExceptionSync(ctx context.Context) {
	s.syncExceptions(ctx)

	ticker := time.NewTicker(s.config.Exceptions)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncExceptions(ctx)
		}
	}
}

// syncExceptions fetches exceptions from all clusters and upserts them.
func (s *Syncer) syncExceptions(ctx context.Context) {
	clusters := s.manager.List()

	for _, info := range clusters {
		clusterName := info.Name
		start := time.Now()

		conn, err := s.manager.Get(clusterName)
		if err != nil {
			s.logger.Warn("sync: cannot resolve cluster for exceptions", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("exceptions", clusterName).Inc()
			continue
		}

		// Get active jobs from Flink REST.
		overview, err := conn.Service.GetJobs(ctx)
		if err != nil {
			s.logger.Warn("sync: fetch jobs for exception sync failed", "cluster", clusterName, "error", err)
			observability.SyncErrorsTotal.WithLabelValues("exceptions", clusterName).Inc()
			continue
		}

		upsertCount := 0
		for _, job := range overview.Jobs {
			if job.State != "RUNNING" {
				continue
			}

			jobExceptions, err := conn.Service.GetJobExceptions(ctx, job.JID)
			if err != nil {
				s.logger.Debug("sync: fetch exceptions failed", "cluster", clusterName, "jid", job.JID, "error", err)
				continue
			}

			entries := jobExceptions.ExceptionHistory.Entries
			if len(entries) == 0 {
				continue
			}

			dbExceptions := make([]storage.DBException, len(entries))
			for i, e := range entries {
				dbExceptions[i] = storage.FromFlinkException(e, job.JID, clusterName)
			}

			if err := s.stores.Exceptions.UpsertExceptions(ctx, dbExceptions); err != nil {
				s.logger.Warn("sync: upsert exceptions failed", "cluster", clusterName, "jid", job.JID, "error", err)
				observability.SyncErrorsTotal.WithLabelValues("exceptions", clusterName).Inc()
				continue
			}
			upsertCount += len(dbExceptions)
		}

		observability.SyncUpsertsTotal.WithLabelValues("exceptions", clusterName).Add(float64(upsertCount))
		observability.SyncDurationSeconds.WithLabelValues("exceptions", clusterName).Observe(time.Since(start).Seconds())

		if upsertCount > 0 {
			s.logger.Debug("sync: exceptions synced", "cluster", clusterName, "upserted", upsertCount)
		}
	}
}

// syncJobExceptions fetches and upserts exceptions for a single job.
func (s *Syncer) syncJobExceptions(ctx context.Context, clusterName, jid string) error {
	conn, err := s.manager.Get(clusterName)
	if err != nil {
		return fmt.Errorf("resolve cluster: %w", err)
	}

	jobExceptions, err := conn.Service.GetJobExceptions(ctx, jid)
	if err != nil {
		return fmt.Errorf("fetch exceptions: %w", err)
	}

	entries := jobExceptions.ExceptionHistory.Entries
	if len(entries) == 0 {
		return nil
	}

	dbExceptions := make([]storage.DBException, len(entries))
	for i, e := range entries {
		dbExceptions[i] = storage.FromFlinkException(e, jid, clusterName)
	}

	return s.stores.Exceptions.UpsertExceptions(ctx, dbExceptions)
}
