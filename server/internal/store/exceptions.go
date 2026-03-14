package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// ExceptionStore provides upsert and query operations for the exceptions table.
type ExceptionStore struct {
	pool *pgxpool.Pool
}

// ExceptionFilter defines optional filter criteria for QueryExceptions.
type ExceptionFilter struct {
	ClusterID     *string
	JobID         *string
	ExceptionName *string
	After         *time.Time
	Before        *time.Time
}

// UpsertExceptions batch-inserts exception records, skipping duplicates
// via the dedup unique index (jid, cluster, exception_name, timestamp).
func (s *ExceptionStore) UpsertExceptions(ctx context.Context, exceptions []storage.DBException) error {
	if len(exceptions) == 0 {
		return nil
	}

	const cols = 8
	args := make([]any, 0, len(exceptions)*cols)
	placeholders := make([]string, 0, len(exceptions))

	for i, e := range exceptions {
		base := i * cols
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7, base+8,
		))
		args = append(args,
			e.JID, e.Cluster, e.ExceptionName, e.Stacktrace,
			e.Timestamp, e.TaskName, e.Endpoint, e.TaskManagerID,
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO exceptions (jid, cluster, exception_name, stacktrace,
			timestamp, task_name, endpoint, task_manager_id)
		VALUES %s
		ON CONFLICT (jid, cluster, exception_name, timestamp) DO NOTHING
	`, strings.Join(placeholders, ",\n\t\t"))

	_, err := s.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("upsert exceptions: %w", err)
	}
	return nil
}

// QueryExceptions returns exceptions matching the filter with cursor-based pagination.
func (s *ExceptionStore) QueryExceptions(ctx context.Context, filter ExceptionFilter, pagination CursorPagination) ([]storage.DBException, string, error) {
	limit := pagination.First
	if limit <= 0 {
		limit = 20
	}

	var conditions []string
	var args []any
	argIdx := 1

	if filter.ClusterID != nil {
		conditions = append(conditions, fmt.Sprintf("cluster = $%d", argIdx))
		args = append(args, *filter.ClusterID)
		argIdx++
	}
	if filter.JobID != nil {
		conditions = append(conditions, fmt.Sprintf("jid = $%d", argIdx))
		args = append(args, *filter.JobID)
		argIdx++
	}
	if filter.ExceptionName != nil {
		conditions = append(conditions, fmt.Sprintf("exception_name ILIKE $%d", argIdx))
		args = append(args, "%"+*filter.ExceptionName+"%")
		argIdx++
	}
	if filter.After != nil {
		conditions = append(conditions, fmt.Sprintf("timestamp >= $%d", argIdx))
		args = append(args, *filter.After)
		argIdx++
	}
	if filter.Before != nil {
		conditions = append(conditions, fmt.Sprintf("timestamp <= $%d", argIdx))
		args = append(args, *filter.Before)
		argIdx++
	}

	if pagination.After != nil {
		cursorTime, cursorID, err := decodeCursor(*pagination.After)
		if err != nil {
			return nil, "", fmt.Errorf("invalid cursor: %w", err)
		}
		conditions = append(conditions, fmt.Sprintf(
			"(timestamp, id::text) < ($%d, $%d)", argIdx, argIdx+1,
		))
		args = append(args, cursorTime, cursorID)
		argIdx += 2
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT id, jid, cluster, exception_name, stacktrace, timestamp,
			task_name, endpoint, task_manager_id, captured_at
		FROM exceptions
		%s
		ORDER BY timestamp DESC, id DESC
		LIMIT $%d
	`, where, argIdx)
	args = append(args, limit+1)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", fmt.Errorf("query exceptions: %w", err)
	}
	defer rows.Close()

	var exceptions []storage.DBException
	for rows.Next() {
		var e storage.DBException
		if err := rows.Scan(
			&e.ID, &e.JID, &e.Cluster, &e.ExceptionName, &e.Stacktrace,
			&e.Timestamp, &e.TaskName, &e.Endpoint, &e.TaskManagerID, &e.CapturedAt,
		); err != nil {
			return nil, "", fmt.Errorf("scan exception row: %w", err)
		}
		exceptions = append(exceptions, e)
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("iterate exceptions: %w", err)
	}

	var nextCursor string
	if len(exceptions) > limit {
		exceptions = exceptions[:limit]
		last := exceptions[limit-1]
		nextCursor = EncodeCursor(&last.Timestamp, fmt.Sprintf("%d", last.ID))
	}

	return exceptions, nextCursor, nil
}
