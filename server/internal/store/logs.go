package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// LogStore provides upsert and query operations for the logs table.
type LogStore struct {
	pool *pgxpool.Pool
}

// UpsertLog inserts or updates a log entry, only replacing content and
// byte_offset when the new content length exceeds the stored byte_offset.
func (s *LogStore) UpsertLog(ctx context.Context, log storage.DBLog) error {
	query := `
		INSERT INTO logs (cluster, source_type, source_id, log_file, content, byte_offset)
		VALUES ($1, $2, $3, $4, $5, $6)
		ON CONFLICT (cluster, source_type, source_id, log_file) DO UPDATE SET
			content     = EXCLUDED.content,
			byte_offset = EXCLUDED.byte_offset,
			captured_at = now()
		WHERE EXCLUDED.byte_offset > logs.byte_offset
	`

	_, err := s.pool.Exec(ctx, query,
		log.Cluster, log.SourceType, log.SourceID, log.LogFile, log.Content, log.ByteOffset,
	)
	if err != nil {
		return fmt.Errorf("upsert log: %w", err)
	}
	return nil
}

// GetLogOffset retrieves the current byte offset for a log source.
// Returns 0 if no entry exists.
func (s *LogStore) GetLogOffset(ctx context.Context, clusterID, sourceType, sourceID, logName string) (int64, error) {
	var offset int64
	err := s.pool.QueryRow(ctx, `
		SELECT byte_offset FROM logs
		WHERE cluster = $1 AND source_type = $2 AND source_id = $3 AND log_file = $4
	`, clusterID, sourceType, sourceID, logName).Scan(&offset)
	if err == pgx.ErrNoRows {
		return 0, nil
	}
	if err != nil {
		return 0, fmt.Errorf("get log offset: %w", err)
	}
	return offset, nil
}
