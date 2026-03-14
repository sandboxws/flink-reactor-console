package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// ClusterStore provides upsert operations for the clusters table.
type ClusterStore struct {
	pool *pgxpool.Pool
}

// UpsertCluster inserts or updates a cluster record.
// On conflict, last_seen semantics are achieved by updating updated_at and url.
func (s *ClusterStore) UpsertCluster(ctx context.Context, c storage.DBCluster) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO clusters (name, url, is_default, created_at, updated_at)
		VALUES ($1, $2, $3, now(), now())
		ON CONFLICT (name) DO UPDATE SET
			url        = EXCLUDED.url,
			updated_at = now()
	`, c.Name, c.URL, c.IsDefault)
	if err != nil {
		return fmt.Errorf("upsert cluster %q: %w", c.Name, err)
	}
	return nil
}
