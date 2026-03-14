package store

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
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

	const cols = 14
	args := make([]any, 0, len(checkpoints)*cols)
	placeholders := make([]string, 0, len(checkpoints))

	for i, c := range checkpoints {
		base := i * cols
		placeholders = append(placeholders, fmt.Sprintf(
			"($%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d,$%d)",
			base+1, base+2, base+3, base+4, base+5, base+6, base+7,
			base+8, base+9, base+10, base+11, base+12, base+13, base+14,
		))
		args = append(args,
			c.CheckpointID, c.JID, c.Cluster, c.Status, c.IsSavepoint,
			c.TriggerTimestamp, c.LatestAck, c.StateSize, c.EndToEndDuration,
			c.ProcessedData, c.PersistedData, c.NumSubtasks, c.NumAckSubtasks,
			c.CheckpointedSize,
		)
	}

	query := fmt.Sprintf(`
		INSERT INTO checkpoints (checkpoint_id, jid, cluster, status, is_savepoint,
			trigger_timestamp, latest_ack, state_size, end_to_end_duration,
			processed_data, persisted_data, num_subtasks, num_ack_subtasks,
			checkpointed_size)
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
			checkpointed_size, captured_at
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
			&c.CheckpointedSize, &c.CapturedAt,
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
