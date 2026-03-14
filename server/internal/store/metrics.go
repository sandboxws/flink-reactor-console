package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// MetricStore provides append-only insert and time-range query operations
// for the metrics partitioned table and cluster_overview_snapshots table.
type MetricStore struct {
	pool *pgxpool.Pool
}

// MetricFilter defines optional filter criteria for QueryMetrics.
type MetricFilter struct {
	ClusterID  *string
	SourceType *string
	SourceID   *string
	MetricID   *string
	After      *time.Time
	Before     *time.Time
}

// InsertMetrics batch-inserts metrics using append-only writes.
func (s *MetricStore) InsertMetrics(ctx context.Context, metrics []storage.DBMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	const cols = 5
	args := make([]any, 0, len(metrics)*cols)
	placeholders := make([]string, 0, len(metrics))

	for i, m := range metrics {
		base := i * cols
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5,
		))
		args = append(args, m.Cluster, m.SourceType, m.SourceID, m.MetricID, m.Value)
	}

	query := fmt.Sprintf(`
		INSERT INTO metrics (cluster, source_type, source_id, metric_id, value)
		VALUES %s
	`, strings.Join(placeholders, ",\n\t\t"))

	_, err := s.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("insert metrics: %w", err)
	}
	return nil
}

// QueryMetrics returns metrics matching the filter ordered by captured_at descending.
func (s *MetricStore) QueryMetrics(ctx context.Context, filter MetricFilter) ([]storage.DBMetric, error) {
	var conditions []string
	var args []any
	argIdx := 1

	if filter.ClusterID != nil {
		conditions = append(conditions, fmt.Sprintf("cluster = $%d", argIdx))
		args = append(args, *filter.ClusterID)
		argIdx++
	}
	if filter.SourceType != nil {
		conditions = append(conditions, fmt.Sprintf("source_type = $%d", argIdx))
		args = append(args, *filter.SourceType)
		argIdx++
	}
	if filter.SourceID != nil {
		conditions = append(conditions, fmt.Sprintf("source_id = $%d", argIdx))
		args = append(args, *filter.SourceID)
		argIdx++
	}
	if filter.MetricID != nil {
		conditions = append(conditions, fmt.Sprintf("metric_id = $%d", argIdx))
		args = append(args, *filter.MetricID)
		argIdx++
	}
	if filter.After != nil {
		conditions = append(conditions, fmt.Sprintf("captured_at >= $%d", argIdx))
		args = append(args, *filter.After)
		argIdx++
	}
	if filter.Before != nil {
		conditions = append(conditions, fmt.Sprintf("captured_at <= $%d", argIdx))
		args = append(args, *filter.Before)
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT id, cluster, source_type, source_id, metric_id, value, captured_at
		FROM metrics
		%s
		ORDER BY captured_at ASC
		LIMIT 10000
	`, where)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query metrics: %w", err)
	}
	defer rows.Close()

	var result []storage.DBMetric
	for rows.Next() {
		var m storage.DBMetric
		if err := rows.Scan(&m.ID, &m.Cluster, &m.SourceType, &m.SourceID, &m.MetricID, &m.Value, &m.CapturedAt); err != nil {
			return nil, fmt.Errorf("scan metric row: %w", err)
		}
		result = append(result, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate metrics: %w", err)
	}

	return result, nil
}

// EnsurePartition creates a monthly partition for the metrics table if it doesn't exist.
// The partition covers [monthStart, monthStart+1month).
func (s *MetricStore) EnsurePartition(ctx context.Context, month time.Time) error {
	// Normalize to first of month in UTC.
	start := time.Date(month.Year(), month.Month(), 1, 0, 0, 0, 0, time.UTC)
	end := start.AddDate(0, 1, 0)

	partName := fmt.Sprintf("metrics_%s", start.Format("2006_01"))

	query := fmt.Sprintf(`
		CREATE TABLE IF NOT EXISTS %s PARTITION OF metrics
		FOR VALUES FROM ('%s') TO ('%s')
	`, partName, start.Format("2006-01-02"), end.Format("2006-01-02"))

	_, err := s.pool.Exec(ctx, query)
	if err != nil {
		return fmt.Errorf("ensure partition %s: %w", partName, err)
	}
	return nil
}

// EnsureCurrentPartitions creates partitions for the current and next month.
func (s *MetricStore) EnsureCurrentPartitions(ctx context.Context) error {
	now := time.Now().UTC()
	if err := s.EnsurePartition(ctx, now); err != nil {
		return err
	}
	return s.EnsurePartition(ctx, now.AddDate(0, 1, 0))
}

// InsertOverviewSnapshot inserts a cluster overview snapshot.
func (s *MetricStore) InsertOverviewSnapshot(ctx context.Context, snapshot storage.DBClusterOverviewSnapshot) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO cluster_overview_snapshots (cluster, flink_version, slots_total, slots_available,
			jobs_running, jobs_finished, jobs_cancelled, jobs_failed, task_managers)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`, snapshot.Cluster, snapshot.FlinkVersion, snapshot.SlotsTotal, snapshot.SlotsAvailable,
		snapshot.JobsRunning, snapshot.JobsFinished, snapshot.JobsCancelled, snapshot.JobsFailed,
		snapshot.TaskManagers)
	if err != nil {
		return fmt.Errorf("insert overview snapshot %s: %w", snapshot.Cluster, err)
	}
	return nil
}

// QueryOverviewSnapshots returns cluster overview snapshots within a time range.
func (s *MetricStore) QueryOverviewSnapshots(ctx context.Context, clusterID string, after, before time.Time) ([]storage.DBClusterOverviewSnapshot, error) {
	var conditions []string
	var args []any
	argIdx := 1

	conditions = append(conditions, fmt.Sprintf("cluster = $%d", argIdx))
	args = append(args, clusterID)
	argIdx++

	if !after.IsZero() {
		conditions = append(conditions, fmt.Sprintf("captured_at >= $%d", argIdx))
		args = append(args, after)
		argIdx++
	}
	if !before.IsZero() {
		conditions = append(conditions, fmt.Sprintf("captured_at <= $%d", argIdx))
		args = append(args, before)
	}

	where := "WHERE " + strings.Join(conditions, " AND ")

	query := fmt.Sprintf(`
		SELECT cluster, flink_version, slots_total, slots_available,
			jobs_running, jobs_finished, jobs_cancelled, jobs_failed,
			task_managers, captured_at
		FROM cluster_overview_snapshots
		%s
		ORDER BY captured_at ASC
		LIMIT 10000
	`, where)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query overview snapshots: %w", err)
	}
	defer rows.Close()

	var result []storage.DBClusterOverviewSnapshot
	for rows.Next() {
		var snap storage.DBClusterOverviewSnapshot
		if err := rows.Scan(
			&snap.Cluster, &snap.FlinkVersion, &snap.SlotsTotal, &snap.SlotsAvailable,
			&snap.JobsRunning, &snap.JobsFinished, &snap.JobsCancelled, &snap.JobsFailed,
			&snap.TaskManagers, &snap.CapturedAt,
		); err != nil {
			return nil, fmt.Errorf("scan overview snapshot: %w", err)
		}
		result = append(result, snap)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate overview snapshots: %w", err)
	}

	return result, nil
}
