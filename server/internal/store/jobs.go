package store

import (
	"context"
	"encoding/base64"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// JobStore provides upsert and query operations for the jobs and vertices tables.
type JobStore struct {
	pool *pgxpool.Pool
}

// JobFilter defines optional filter criteria for QueryJobs.
type JobFilter struct {
	ClusterID *string
	State     *string
	Name      *string
	After     *time.Time
	Before    *time.Time
}

// CursorPagination defines cursor-based pagination parameters.
type CursorPagination struct {
	First int
	After *string // opaque cursor
}

// UpsertJob inserts or updates a job record using the composite PK (jid, cluster).
func (s *JobStore) UpsertJob(ctx context.Context, j storage.DBJob) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO jobs (jid, cluster, name, state, start_time, end_time,
			duration_ms, last_modified, tasks_total, tasks_running,
			tasks_finished, tasks_canceled, tasks_failed, captured_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
		ON CONFLICT (jid, cluster) DO UPDATE SET
			name           = EXCLUDED.name,
			state          = EXCLUDED.state,
			start_time     = EXCLUDED.start_time,
			end_time       = EXCLUDED.end_time,
			duration_ms    = EXCLUDED.duration_ms,
			last_modified  = EXCLUDED.last_modified,
			tasks_total    = EXCLUDED.tasks_total,
			tasks_running  = EXCLUDED.tasks_running,
			tasks_finished = EXCLUDED.tasks_finished,
			tasks_canceled = EXCLUDED.tasks_canceled,
			tasks_failed   = EXCLUDED.tasks_failed,
			captured_at    = EXCLUDED.captured_at
	`, j.JID, j.Cluster, j.Name, j.State, j.StartTime, j.EndTime,
		j.DurationMs, j.LastModified, j.TasksTotal, j.TasksRunning,
		j.TasksFinished, j.TasksCanceled, j.TasksFailed, j.CapturedAt)
	if err != nil {
		return fmt.Errorf("upsert job %s/%s: %w", j.Cluster, j.JID, err)
	}
	return nil
}

// UpsertVertices batch-upserts vertex records.
func (s *JobStore) UpsertVertices(ctx context.Context, vertices []storage.DBVertex) error {
	if len(vertices) == 0 {
		return nil
	}

	// Build a batch insert with ON CONFLICT for each vertex.
	const cols = 14
	args := make([]any, 0, len(vertices)*cols)
	placeholders := make([]string, 0, len(vertices))

	for i, v := range vertices {
		base := i * cols
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7,
			base+8, base+9, base+10, base+11, base+12, base+13, base+14,
		))
		args = append(args,
			v.ID, v.JID, v.Cluster, v.Name, v.Parallelism, v.MaxParallelism,
			v.Status, v.StartTime, v.EndTime, v.DurationMs,
			v.ReadBytes, v.WriteBytes, v.ReadRecords, v.WriteRecords,
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO vertices (id, jid, cluster, name, parallelism, max_parallelism,
			status, start_time, end_time, duration_ms,
			read_bytes, write_bytes, read_records, write_records)
		VALUES %s
		ON CONFLICT (id, jid, cluster) DO UPDATE SET
			name            = EXCLUDED.name,
			parallelism     = EXCLUDED.parallelism,
			max_parallelism = EXCLUDED.max_parallelism,
			status          = EXCLUDED.status,
			start_time      = EXCLUDED.start_time,
			end_time        = EXCLUDED.end_time,
			duration_ms     = EXCLUDED.duration_ms,
			read_bytes      = EXCLUDED.read_bytes,
			write_bytes     = EXCLUDED.write_bytes,
			read_records    = EXCLUDED.read_records,
			write_records   = EXCLUDED.write_records,
			captured_at     = now()
	`, strings.Join(placeholders, ",\n\t\t"))

	_, err := s.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("upsert vertices: %w", err)
	}
	return nil
}

// QueryJobs returns jobs matching the filter with cursor-based pagination.
// Returns the result slice, next cursor (empty if no more pages), and any error.
func (s *JobStore) QueryJobs(ctx context.Context, filter JobFilter, pagination CursorPagination) ([]storage.DBJob, string, error) {
	limit := pagination.First
	if limit <= 0 {
		limit = 20
	}

	// Build WHERE clause dynamically.
	var conditions []string
	var args []any
	argIdx := 1

	if filter.ClusterID != nil {
		conditions = append(conditions, fmt.Sprintf("cluster = $%d", argIdx))
		args = append(args, *filter.ClusterID)
		argIdx++
	}
	if filter.State != nil {
		conditions = append(conditions, fmt.Sprintf("state = $%d", argIdx))
		args = append(args, *filter.State)
		argIdx++
	}
	if filter.Name != nil {
		conditions = append(conditions, fmt.Sprintf("name ILIKE $%d", argIdx))
		args = append(args, "%"+*filter.Name+"%")
		argIdx++
	}
	if filter.After != nil {
		conditions = append(conditions, fmt.Sprintf("start_time >= $%d", argIdx))
		args = append(args, *filter.After)
		argIdx++
	}
	if filter.Before != nil {
		conditions = append(conditions, fmt.Sprintf("start_time <= $%d", argIdx))
		args = append(args, *filter.Before)
		argIdx++
	}

	// Decode cursor: "start_time|jid"
	if pagination.After != nil {
		cursorTime, cursorJID, err := decodeCursor(*pagination.After)
		if err != nil {
			return nil, "", fmt.Errorf("invalid cursor: %w", err)
		}
		conditions = append(conditions, fmt.Sprintf(
			"(start_time, jid) < ($%d, $%d)", argIdx, argIdx+1,
		))
		args = append(args, cursorTime, cursorJID)
		argIdx += 2
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	// Fetch one extra to determine hasNextPage.
	query := fmt.Sprintf(`
		SELECT jid, cluster, name, state, start_time, end_time,
			duration_ms, last_modified, tasks_total, tasks_running,
			tasks_finished, tasks_canceled, tasks_failed, captured_at
		FROM jobs
		%s
		ORDER BY start_time DESC, jid DESC
		LIMIT $%d
	`, where, argIdx)
	args = append(args, limit+1)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", fmt.Errorf("query jobs: %w", err)
	}
	defer rows.Close()

	var jobs []storage.DBJob
	for rows.Next() {
		var j storage.DBJob
		if err := rows.Scan(
			&j.JID, &j.Cluster, &j.Name, &j.State, &j.StartTime, &j.EndTime,
			&j.DurationMs, &j.LastModified, &j.TasksTotal, &j.TasksRunning,
			&j.TasksFinished, &j.TasksCanceled, &j.TasksFailed, &j.CapturedAt,
		); err != nil {
			return nil, "", fmt.Errorf("scan job row: %w", err)
		}
		jobs = append(jobs, j)
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("iterate jobs: %w", err)
	}

	// Determine next cursor.
	var nextCursor string
	if len(jobs) > limit {
		jobs = jobs[:limit] // trim the extra row
		last := jobs[limit-1]
		nextCursor = EncodeCursor(last.StartTime, last.JID)
	}

	return jobs, nextCursor, nil
}

// EncodeCursor creates an opaque cursor from a start_time and jid.
func EncodeCursor(startTime *time.Time, jid string) string {
	var ts string
	if startTime != nil {
		ts = startTime.Format(time.RFC3339Nano)
	}
	return base64.StdEncoding.EncodeToString([]byte(ts + "|" + jid))
}

// decodeCursor parses an opaque cursor back into start_time and jid.
func decodeCursor(cursor string) (time.Time, string, error) {
	b, err := base64.StdEncoding.DecodeString(cursor)
	if err != nil {
		return time.Time{}, "", err
	}
	parts := strings.SplitN(string(b), "|", 2)
	if len(parts) != 2 {
		return time.Time{}, "", fmt.Errorf("malformed cursor")
	}
	t, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return time.Time{}, "", fmt.Errorf("parse cursor time: %w", err)
	}
	return t, parts[1], nil
}
