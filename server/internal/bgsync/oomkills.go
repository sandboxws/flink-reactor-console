package bgsync

import (
	"context"
	"time"

	"github.com/sandboxws/flink-reactor-console/server/internal/k8s"
	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
)

// runOOMKillSync polls TaskManager pod status (for clusters with a configured
// K8s service) and records OOM kills as an "oomKills" cluster metric — a
// queryable time-series of container OOM terminations that Flink's own REST API
// cannot see. It reuses the task-manager sync interval.
//
// UNVERIFIED against a live cluster: the pod listing beneath this loop has not
// been exercised against a real Kubernetes API server. The dedup accounting
// (countNewOOMKills) IS unit-tested.
func (s *Syncer) runOOMKillSync(ctx context.Context) {
	s.syncOOMKills(ctx)

	ticker := time.NewTicker(s.config.TaskManagers)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.syncOOMKills(ctx)
		}
	}
}

func (s *Syncer) syncOOMKills(ctx context.Context) {
	for _, info := range s.manager.List() {
		clusterName := info.Name

		conn, err := s.manager.Get(clusterName)
		if err != nil || conn.K8sService == nil {
			continue // K8s not configured for this cluster
		}

		kills, err := conn.K8sService.ListOOMKills(ctx)
		if err != nil {
			s.logger.Debug("sync: list OOM kills failed", "cluster", clusterName, "error", err)
			continue
		}

		newKills := s.recordNewOOMKills(clusterName, kills)
		if newKills == 0 {
			continue
		}

		metric := storage.DBMetric{
			Cluster:    clusterName,
			SourceType: "cluster",
			SourceID:   clusterName,
			MetricID:   "oomKills",
			Value:      float64(newKills),
			CapturedAt: time.Now().UTC(),
		}
		if err := s.stores.Metrics.InsertMetrics(ctx, []storage.DBMetric{metric}); err != nil {
			s.logger.Warn("sync: insert OOM kills failed", "cluster", clusterName, "error", err)
		}
	}
}

// recordNewOOMKills updates the per-cluster seen-state and returns how many OOM
// kills are new since the last poll. The first observation for a cluster only
// seeds the baseline, so a still-present terminated lastState isn't recounted
// every tick and the count never spikes right after startup.
func (s *Syncer) recordNewOOMKills(cluster string, kills []k8s.OOMKill) int {
	s.oomMu.Lock()
	defer s.oomMu.Unlock()

	seen, had := s.lastOOMRestart[cluster]
	if !had {
		seen = make(map[string]int)
		s.lastOOMRestart[cluster] = seen
	}
	return countNewOOMKills(seen, kills, !had)
}

// countNewOOMKills folds kills into seen (pod/container -> highest restart count
// observed) and returns how many are new (never seen, or with an advanced
// restart count). When seeding is true it only populates the baseline and
// returns 0.
func countNewOOMKills(seen map[string]int, kills []k8s.OOMKill, seeding bool) int {
	count := 0
	for _, k := range kills {
		key := k.Pod + "/" + k.Container
		prev, ok := seen[key]
		if !ok || k.RestartCount > prev {
			seen[key] = k.RestartCount
			if !seeding {
				count++
			}
		}
	}
	return count
}
