package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// JobManagerStore provides upsert operations for the job_manager_snapshots table.
type JobManagerStore struct {
	pool *pgxpool.Pool
}

// UpsertJobManager upserts a job manager snapshot using the PK (cluster).
func (s *JobManagerStore) UpsertJobManager(ctx context.Context, snapshot storage.DBJobManagerSnapshot) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO job_manager_snapshots (cluster, config_json, environment_json)
		VALUES ($1, $2, $3)
		ON CONFLICT (cluster) DO UPDATE SET
			config_json      = EXCLUDED.config_json,
			environment_json = EXCLUDED.environment_json,
			captured_at      = now()
	`, snapshot.Cluster, snapshot.ConfigJSON, snapshot.EnvironmentJSON)
	if err != nil {
		return fmt.Errorf("upsert job manager %s: %w", snapshot.Cluster, err)
	}
	return nil
}
