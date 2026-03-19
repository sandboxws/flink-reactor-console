package store

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

// TapManifestStore provides CRUD operations for the tap_manifests table.
type TapManifestStore struct {
	pool *pgxpool.Pool
}

// Upsert inserts or updates a tap manifest record.
// On conflict by pipeline_name, the manifest and flink_version are updated.
func (s *TapManifestStore) Upsert(ctx context.Context, m storage.DBTapManifest) error {
	_, err := s.pool.Exec(ctx, `
		INSERT INTO tap_manifests (pipeline_name, manifest, flink_version, created_at, updated_at)
		VALUES ($1, $2, $3, now(), now())
		ON CONFLICT (pipeline_name) DO UPDATE SET
			manifest      = EXCLUDED.manifest,
			flink_version = EXCLUDED.flink_version,
			updated_at    = now()
	`, m.PipelineName, m.Manifest, m.FlinkVersion)
	if err != nil {
		return fmt.Errorf("upsert tap manifest %q: %w", m.PipelineName, err)
	}
	return nil
}

// GetByPipeline returns the tap manifest for the given pipeline name.
// Returns nil if not found.
func (s *TapManifestStore) GetByPipeline(ctx context.Context, pipelineName string) (*storage.DBTapManifest, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT pipeline_name, manifest, flink_version, created_at, updated_at
		FROM tap_manifests
		WHERE pipeline_name = $1
	`, pipelineName)

	var m storage.DBTapManifest
	err := row.Scan(&m.PipelineName, &m.Manifest, &m.FlinkVersion, &m.CreatedAt, &m.UpdatedAt)
	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get tap manifest %q: %w", pipelineName, err)
	}
	return &m, nil
}

// List returns all tap manifests ordered by pipeline name.
func (s *TapManifestStore) List(ctx context.Context) ([]storage.DBTapManifest, error) {
	rows, err := s.pool.Query(ctx, `
		SELECT pipeline_name, manifest, flink_version, created_at, updated_at
		FROM tap_manifests
		ORDER BY pipeline_name
	`)
	if err != nil {
		return nil, fmt.Errorf("list tap manifests: %w", err)
	}
	defer rows.Close()

	var manifests []storage.DBTapManifest
	for rows.Next() {
		var m storage.DBTapManifest
		if err := rows.Scan(&m.PipelineName, &m.Manifest, &m.FlinkVersion, &m.CreatedAt, &m.UpdatedAt); err != nil {
			return nil, fmt.Errorf("scan tap manifest: %w", err)
		}
		manifests = append(manifests, m)
	}
	return manifests, rows.Err()
}

// Delete removes a tap manifest by pipeline name.
// Returns true if a row was deleted, false if not found.
func (s *TapManifestStore) Delete(ctx context.Context, pipelineName string) (bool, error) {
	tag, err := s.pool.Exec(ctx, `
		DELETE FROM tap_manifests WHERE pipeline_name = $1
	`, pipelineName)
	if err != nil {
		return false, fmt.Errorf("delete tap manifest %q: %w", pipelineName, err)
	}
	return tag.RowsAffected() > 0, nil
}
