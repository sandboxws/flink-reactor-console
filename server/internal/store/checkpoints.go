package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
)

// CheckpointStore provides upsert and query operations for the checkpoints table.
type CheckpointStore struct {
	pool *pgxpool.Pool
}

// CheckpointFilter defines optional filter criteria for QueryCheckpoints.
type CheckpointFilter struct {
	ClusterID   *string
	JobID       *string
	Status      *string
	IsSavepoint *bool
	After       *time.Time
	Before      *time.Time
}

// UpsertCheckpoints batch-upserts checkpoint records using the composite PK (checkpoint_id, jid, cluster).
func (s *CheckpointStore) UpsertCheckpoints(ctx context.Context, checkpoints []storage.DBCheckpoint) error {
	if len(checkpoints) == 0 {
		return nil
	}

	const cols = 17
	args := make([]any, 0, len(checkpoints)*cols)
	placeholders := make([]string, 0, len(checkpoints))

	for i, c := range checkpoints {
		base := i * cols
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7,
			base+8, base+9, base+10, base+11, base+12, base+13, base+14,
			base+15, base+16, base+17,
		))
		args = append(
			args,
			c.CheckpointID, c.JID, c.Cluster, c.Status, c.IsSavepoint,
			c.TriggerTimestamp, c.LatestAck, c.StateSize, c.EndToEndDuration,
			c.ProcessedData, c.PersistedData, c.NumSubtasks, c.NumAckSubtasks,
			c.CheckpointedSize, c.FailureMessage, c.FailureTimestamp, c.ExternalPath,
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO checkpoints (checkpoint_id, jid, cluster, status, is_savepoint,
			trigger_timestamp, latest_ack, state_size, end_to_end_duration,
			processed_data, persisted_data, num_subtasks, num_ack_subtasks,
			checkpointed_size, failure_message, failure_timestamp, external_path)
		VALUES %s
		ON CONFLICT (checkpoint_id, jid, cluster) DO UPDATE SET
			status             = EXCLUDED.status,
			is_savepoint       = EXCLUDED.is_savepoint,
			trigger_timestamp  = EXCLUDED.trigger_timestamp,
			latest_ack         = EXCLUDED.latest_ack,
			state_size         = EXCLUDED.state_size,
			end_to_end_duration = EXCLUDED.end_to_end_duration,
			processed_data     = EXCLUDED.processed_data,
			persisted_data     = EXCLUDED.persisted_data,
			num_subtasks       = EXCLUDED.num_subtasks,
			num_ack_subtasks   = EXCLUDED.num_ack_subtasks,
			checkpointed_size  = EXCLUDED.checkpointed_size,
			failure_message    = EXCLUDED.failure_message,
			failure_timestamp  = EXCLUDED.failure_timestamp,
			external_path      = EXCLUDED.external_path,
			captured_at        = now()
	`, strings.Join(placeholders, ",\n\t\t"))

	_, err := s.pool.Exec(ctx, query, args...)
	if err != nil {
		return fmt.Errorf("upsert checkpoints: %w", err)
	}
	return nil
}

// QueryCheckpoints returns checkpoints matching the filter with cursor-based pagination.
func (s *CheckpointStore) QueryCheckpoints(ctx context.Context, filter CheckpointFilter, pagination CursorPagination) ([]storage.DBCheckpoint, string, error) {
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
	if filter.Status != nil {
		conditions = append(conditions, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *filter.Status)
		argIdx++
	}
	if filter.IsSavepoint != nil {
		conditions = append(conditions, fmt.Sprintf("is_savepoint = $%d", argIdx))
		args = append(args, *filter.IsSavepoint)
		argIdx++
	}
	if filter.After != nil {
		conditions = append(conditions, fmt.Sprintf("trigger_timestamp >= $%d", argIdx))
		args = append(args, *filter.After)
		argIdx++
	}
	if filter.Before != nil {
		conditions = append(conditions, fmt.Sprintf("trigger_timestamp <= $%d", argIdx))
		args = append(args, *filter.Before)
		argIdx++
	}

	if pagination.After != nil {
		cursorTime, cursorID, err := decodeCursor(*pagination.After)
		if err != nil {
			return nil, "", fmt.Errorf("invalid cursor: %w", err)
		}
		conditions = append(conditions, fmt.Sprintf(
			"(trigger_timestamp, checkpoint_id::text) < ($%d, $%d)", argIdx, argIdx+1,
		))
		args = append(args, cursorTime, cursorID)
		argIdx += 2
	}

	where := ""
	if len(conditions) > 0 {
		where = "WHERE " + strings.Join(conditions, " AND ")
	}

	query := fmt.Sprintf(`
		SELECT checkpoint_id, jid, cluster, status, is_savepoint,
			trigger_timestamp, latest_ack, state_size, end_to_end_duration,
			processed_data, persisted_data, num_subtasks, num_ack_subtasks,
			checkpointed_size, failure_message, failure_timestamp, external_path,
			captured_at
		FROM checkpoints
		%s
		ORDER BY trigger_timestamp DESC, checkpoint_id DESC
		LIMIT $%d
	`, where, argIdx)
	args = append(args, limit+1)

	rows, err := s.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, "", fmt.Errorf("query checkpoints: %w", err)
	}
	defer rows.Close()

	var checkpoints []storage.DBCheckpoint
	for rows.Next() {
		var c storage.DBCheckpoint
		if err := rows.Scan(
			&c.CheckpointID, &c.JID, &c.Cluster, &c.Status, &c.IsSavepoint,
			&c.TriggerTimestamp, &c.LatestAck, &c.StateSize, &c.EndToEndDuration,
			&c.ProcessedData, &c.PersistedData, &c.NumSubtasks, &c.NumAckSubtasks,
			&c.CheckpointedSize, &c.FailureMessage, &c.FailureTimestamp, &c.ExternalPath,
			&c.CapturedAt,
		); err != nil {
			return nil, "", fmt.Errorf("scan checkpoint row: %w", err)
		}
		checkpoints = append(checkpoints, c)
	}
	if err := rows.Err(); err != nil {
		return nil, "", fmt.Errorf("iterate checkpoints: %w", err)
	}

	var nextCursor string
	if len(checkpoints) > limit {
		checkpoints = checkpoints[:limit]
		last := checkpoints[limit-1]
		nextCursor = EncodeCursor(last.TriggerTimestamp, fmt.Sprintf("%d", last.CheckpointID))
	}

	return checkpoints, nextCursor, nil
}

// StateSizeGrowth returns, per job, the percent change in completed-checkpoint
// state size across the lookback window (keyed jid -> growth percent). Unbounded
// state growth is the RocksDB signal behind creeping memory use and eventual
// OOMKills. Jobs with fewer than two completed checkpoints in the window, or a
// zero starting size, are omitted.
func (s *CheckpointStore) StateSizeGrowth(
	ctx context.Context,
	clusterID string,
	within time.Duration,
) (map[string]float64, error) {
	// The explicit ROWS frame is required so last_value sees the whole partition
	// (its default frame would stop at the current row).
	query := `
		WITH bounds AS (
			SELECT jid,
				first_value(state_size) OVER w AS first_size,
				last_value(state_size)  OVER w AS last_size,
				count(*)                OVER w AS n
			FROM checkpoints
			WHERE cluster = $1
			  AND status = 'COMPLETED'
			  AND state_size > 0
			  AND trigger_timestamp >= $2
			WINDOW w AS (
				PARTITION BY jid ORDER BY trigger_timestamp
				ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING
			)
		)
		SELECT DISTINCT jid, first_size, last_size FROM bounds WHERE n >= 2
	`

	rows, err := s.pool.Query(ctx, query, clusterID, time.Now().Add(-within))
	if err != nil {
		return nil, fmt.Errorf("state size growth: %w", err)
	}
	defer rows.Close()

	out := make(map[string]float64)
	for rows.Next() {
		var jid string
		var first, last int64
		if err := rows.Scan(&jid, &first, &last); err != nil {
			return nil, fmt.Errorf("scan state size growth: %w", err)
		}
		if first > 0 {
			out[jid] = float64(last-first) / float64(first) * 100.0
		}
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate state size growth: %w", err)
	}

	return out, nil
}
