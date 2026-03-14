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
// for the metrics hypertable and cluster_overview_snapshots table.
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

// MetricCatalogEntry represents a unique metric discovered from stored data.
type MetricCatalogEntry struct {
	SourceType string
	SourceID   string
	MetricID   string
}

// MetricSeriesRequest identifies a single metric time series to fetch.
type MetricSeriesRequest struct {
	SourceType string
	SourceID   string
	MetricID   string
}

// MetricSeriesPoint is a single data point in a metric time series.
type MetricSeriesPoint struct {
	Timestamp time.Time
	Value     float64
}

// MetricSeriesResult is the time series for one metric.
type MetricSeriesResult struct {
	SourceType string
	SourceID   string
	MetricID   string
	Points     []MetricSeriesPoint
}

// InsertMetrics batch-inserts metrics using append-only writes.
func (s *MetricStore) InsertMetrics(ctx context.Context, metrics []storage.DBMetric) error {
	if len(metrics) == 0 {
		return nil
	}

	const cols = 6
	args := make([]any, 0, len(metrics)*cols)
	placeholders := make([]string, 0, len(metrics))

	for i, m := range metrics {
		base := i * cols
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6,
		))
		args = append(args, m.CapturedAt, m.Cluster, m.SourceType, m.SourceID, m.MetricID, m.Value)
	}

	query := fmt.Sprintf(`
		INSERT INTO metrics (captured_at, cluster, source_type, source_id, metric_id, value)
		VALUES %s
	`, strings.Join(placeholders, ",\n\t\t"))

	_, err := s.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("insert metrics: %w", err)
	}
	return nil
}

// QueryMetrics returns metrics matching the filter ordered by captured_at ascending.
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
		SELECT cluster, source_type, source_id, metric_id, value, captured_at
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
		if err := rows.Scan(&m.Cluster, &m.SourceType, &m.SourceID, &m.MetricID, &m.Value, &m.CapturedAt); err != nil {
			return nil, fmt.Errorf("scan metric row: %w", err)
		}
		result = append(result, m)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate metrics: %w", err)
	}

	return result, nil
}

// QueryMetricCatalog returns distinct metric identifiers that have data within the last hour.
func (s *MetricStore) QueryMetricCatalog(ctx context.Context, clusterID string) ([]MetricCatalogEntry, error) {
	query := `
		SELECT DISTINCT source_type, source_id, metric_id
		FROM metrics
		WHERE cluster = $1 AND captured_at > NOW() - INTERVAL '1 hour'
		ORDER BY source_type, source_id, metric_id
	`

	rows, err := s.pool.Query(ctx, query, clusterID)
	if err != nil {
		return nil, fmt.Errorf("query metric catalog: %w", err)
	}
	defer rows.Close()

	var result []MetricCatalogEntry
	for rows.Next() {
		var e MetricCatalogEntry
		if err := rows.Scan(&e.SourceType, &e.SourceID, &e.MetricID); err != nil {
			return nil, fmt.Errorf("scan metric catalog entry: %w", err)
		}
		result = append(result, e)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate metric catalog: %w", err)
	}

	return result, nil
}

// QueryMetricSeries fetches time-series data for multiple metrics in a single batch.
// For time ranges <= 1h, raw data is used. For longer ranges, the 1-minute continuous
// aggregate is queried. If the point count exceeds maxPoints, time_bucket downsampling
// is applied.
func (s *MetricStore) QueryMetricSeries(
	ctx context.Context,
	clusterID string,
	requests []MetricSeriesRequest,
	after, before time.Time,
	maxPoints int,
) ([]MetricSeriesResult, error) {
	if len(requests) == 0 {
		return nil, nil
	}
	if maxPoints <= 0 {
		maxPoints = 500
	}

	timeRange := before.Sub(after)
	useAggregate := timeRange > time.Hour

	// Build WHERE conditions for batch: cluster + time range + (source_type, source_id, metric_id) IN (...)
	args := []any{clusterID, after, before}
	argIdx := 4

	tuples := make([]string, 0, len(requests))
	for _, r := range requests {
		tuples = append(tuples, fmt.Sprintf("($%d,$%d,$%d)", argIdx, argIdx+1, argIdx+2))
		args = append(args, r.SourceType, r.SourceID, r.MetricID)
		argIdx += 3
	}
	tupleList := strings.Join(tuples, ",")

	var query string
	if useAggregate {
		// Compute bucket interval to stay under maxPoints per series.
		// The aggregate has 1-minute resolution; compute a wider bucket if needed.
		totalMinutes := int(timeRange.Minutes())
		bucketMinutes := 1
		if totalMinutes > maxPoints {
			bucketMinutes = (totalMinutes + maxPoints - 1) / maxPoints
		}
		bucketInterval := fmt.Sprintf("%d minutes", bucketMinutes)

		query = fmt.Sprintf(`
			SELECT
				time_bucket('%s', bucket) AS ts,
				source_type, source_id, metric_id,
				AVG(avg_value) AS value
			FROM metrics_1m
			WHERE cluster = $1
			  AND bucket >= $2
			  AND bucket <= $3
			  AND (source_type, source_id, metric_id) IN (%s)
			GROUP BY ts, source_type, source_id, metric_id
			ORDER BY source_type, source_id, metric_id, ts ASC
		`, bucketInterval, tupleList)
	} else {
		// Raw query — check if we need downsampling.
		expectedPoints := int(timeRange.Seconds()) / 15 // ~1 point per 15s sync
		if expectedPoints > maxPoints {
			bucketSeconds := int(timeRange.Seconds()) / maxPoints
			bucketInterval := fmt.Sprintf("%d seconds", bucketSeconds)
			query = fmt.Sprintf(`
				SELECT
					time_bucket('%s', captured_at) AS ts,
					source_type, source_id, metric_id,
					AVG(value) AS value
				FROM metrics
				WHERE cluster = $1
				  AND captured_at >= $2
				  AND captured_at <= $3
				  AND (source_type, source_id, metric_id) IN (%s)
				GROUP BY ts, source_type, source_id, metric_id
				ORDER BY source_type, source_id, metric_id, ts ASC
			`, bucketInterval, tupleList)
		} else {
			query = fmt.Sprintf(`
				SELECT
					captured_at AS ts,
					source_type, source_id, metric_id,
					value
				FROM metrics
				WHERE cluster = $1
				  AND captured_at >= $2
				  AND captured_at <= $3
				  AND (source_type, source_id, metric_id) IN (%s)
				ORDER BY source_type, source_id, metric_id, captured_at ASC
			`, tupleList)
		}
	}

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("query metric series: %w", err)
	}
	defer rows.Close()

	// Collect points grouped by (sourceType, sourceID, metricID).
	type seriesKey struct {
		sourceType, sourceID, metricID string
	}
	grouped := make(map[seriesKey][]MetricSeriesPoint)
	order := make([]seriesKey, 0, len(requests))
	seen := make(map[seriesKey]bool, len(requests))

	for rows.Next() {
		var (
			ts         time.Time
			sourceType string
			sourceID   string
			metricID   string
			value      float64
		)
		if err := rows.Scan(&ts, &sourceType, &sourceID, &metricID, &value); err != nil {
			return nil, fmt.Errorf("scan metric series point: %w", err)
		}
		key := seriesKey{sourceType, sourceID, metricID}
		if !seen[key] {
			seen[key] = true
			order = append(order, key)
		}
		grouped[key] = append(grouped[key], MetricSeriesPoint{
			Timestamp: ts,
			Value:     value,
		})
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate metric series: %w", err)
	}

	// Build results in order of appearance.
	results := make([]MetricSeriesResult, 0, len(order))
	for _, key := range order {
		results = append(results, MetricSeriesResult{
			SourceType: key.sourceType,
			SourceID:   key.sourceID,
			MetricID:   key.metricID,
			Points:     grouped[key],
		})
	}

	// Include empty results for requested series that had no data.
	for _, r := range requests {
		key := seriesKey{r.SourceType, r.SourceID, r.MetricID}
		if !seen[key] {
			results = append(results, MetricSeriesResult{
				SourceType: r.SourceType,
				SourceID:   r.SourceID,
				MetricID:   r.MetricID,
				Points:     []MetricSeriesPoint{},
			})
		}
	}

	return results, nil
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
