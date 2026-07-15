package store

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor-console/server/internal/storage"
)

// PipelineSummaryRow is a per-(pipeline, environment) rollup joining the latest
// manifest, version count, latest compatibility verdict, and restore tallies.
type PipelineSummaryRow struct {
	PipelineName     string
	Environment      string
	LatestVersion    int
	VersionCount     int
	StateFingerprint string
	FlinkVersion     *string
	CreatedAt        time.Time
	LastVerdict      *string
	LastCheckedAt    *time.Time
	LastIssueCount   *int
	RestoreTotal     int
	RestoreSuccess   int
}

// PipelineManifestStore manages the versioned State Manifest registry and the
// compatibility checks and restore outcomes computed against it.
type PipelineManifestStore struct {
	pool *pgxpool.Pool
}

const manifestColumns = `id, pipeline_name, environment, version, flink_version,
	manifest, state_fingerprint, operator_states, source, created_at`

func scanManifest(row pgx.Row) (*storage.DBPipelineManifest, error) {
	var m storage.DBPipelineManifest
	err := row.Scan(
		&m.ID, &m.PipelineName, &m.Environment, &m.Version, &m.FlinkVersion,
		&m.Manifest, &m.StateFingerprint, &m.OperatorStates, &m.Source, &m.CreatedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &m, nil
}

// Insert stores a manifest as the next version for its (pipeline, environment),
// computing version = MAX(version)+1 atomically. The unique index turns a
// concurrent double-insert into a constraint error the caller may retry.
func (s *PipelineManifestStore) Insert(
	ctx context.Context,
	m storage.DBPipelineManifest,
) (storage.DBPipelineManifest, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO pipeline_manifests
			(pipeline_name, environment, version, flink_version, manifest,
			 state_fingerprint, operator_states, source)
		VALUES ($1, $2,
			COALESCE((SELECT MAX(version) FROM pipeline_manifests
			          WHERE pipeline_name = $1 AND environment = $2), 0) + 1,
			$3, $4, $5, $6, $7)
		RETURNING id, version, created_at
	`, m.PipelineName, m.Environment, m.FlinkVersion, m.Manifest,
		m.StateFingerprint, m.OperatorStates, m.Source)
	if err := row.Scan(&m.ID, &m.Version, &m.CreatedAt); err != nil {
		return storage.DBPipelineManifest{}, fmt.Errorf(
			"insert pipeline manifest %q: %w", m.PipelineName, err,
		)
	}
	return m, nil
}

// Latest returns the highest-version manifest for a pipeline+environment, or
// nil when none exists.
func (s *PipelineManifestStore) Latest(
	ctx context.Context,
	pipeline, environment string,
) (*storage.DBPipelineManifest, error) {
	row := s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s FROM pipeline_manifests
		WHERE pipeline_name = $1 AND environment = $2
		ORDER BY version DESC LIMIT 1
	`, manifestColumns), pipeline, environment)
	m, err := scanManifest(row)
	if err != nil {
		return nil, fmt.Errorf("latest pipeline manifest %q: %w", pipeline, err)
	}
	return m, nil
}

// GetByVersion returns a specific manifest version, or nil when not found.
func (s *PipelineManifestStore) GetByVersion(
	ctx context.Context,
	pipeline, environment string,
	version int,
) (*storage.DBPipelineManifest, error) {
	row := s.pool.QueryRow(ctx, fmt.Sprintf(`
		SELECT %s FROM pipeline_manifests
		WHERE pipeline_name = $1 AND environment = $2 AND version = $3
	`, manifestColumns), pipeline, environment, version)
	m, err := scanManifest(row)
	if err != nil {
		return nil, fmt.Errorf("get pipeline manifest %q v%d: %w", pipeline, version, err)
	}
	return m, nil
}

// ListVersions returns up to `limit` manifest versions (newest first). The
// per-pipeline version count is small, so a bounded ordered query suffices
// (the GraphQL contract returns a plain list, not a connection).
func (s *PipelineManifestStore) ListVersions(
	ctx context.Context,
	pipeline, environment string,
	limit int,
) ([]storage.DBPipelineManifest, error) {
	if limit <= 0 || limit > 200 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, fmt.Sprintf(`
		SELECT %s FROM pipeline_manifests
		WHERE pipeline_name = $1 AND environment = $2
		ORDER BY version DESC LIMIT $3
	`, manifestColumns), pipeline, environment, limit)
	if err != nil {
		return nil, fmt.Errorf("list pipeline manifests %q: %w", pipeline, err)
	}
	defer rows.Close()

	var out []storage.DBPipelineManifest
	for rows.Next() {
		var m storage.DBPipelineManifest
		if err := rows.Scan(
			&m.ID, &m.PipelineName, &m.Environment, &m.Version, &m.FlinkVersion,
			&m.Manifest, &m.StateFingerprint, &m.OperatorStates, &m.Source, &m.CreatedAt,
		); err != nil {
			return nil, fmt.Errorf("scan pipeline manifest: %w", err)
		}
		out = append(out, m)
	}
	return out, rows.Err()
}

// SaveCheck persists a compatibility check result and returns its id.
func (s *PipelineManifestStore) SaveCheck(
	ctx context.Context,
	c storage.DBCompatibilityCheck,
) (int64, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO compatibility_checks
			(pipeline_name, environment, from_manifest_id, to_manifest_id,
			 from_version, to_version, verdict, can_proceed, issues)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
		RETURNING id
	`, c.PipelineName, c.Environment, c.FromManifestID, c.ToManifestID,
		c.FromVersion, c.ToVersion, c.Verdict, c.CanProceed, c.Issues)
	var id int64
	if err := row.Scan(&id); err != nil {
		return 0, fmt.Errorf("save compatibility check %q: %w", c.PipelineName, err)
	}
	return id, nil
}

// LatestCheck returns the most recent compatibility check for a pipeline, or nil.
func (s *PipelineManifestStore) LatestCheck(
	ctx context.Context,
	pipeline, environment string,
) (*storage.DBCompatibilityCheck, error) {
	row := s.pool.QueryRow(ctx, `
		SELECT id, pipeline_name, environment, from_manifest_id, to_manifest_id,
		       from_version, to_version, verdict, can_proceed, issues, checked_at
		FROM compatibility_checks
		WHERE pipeline_name = $1 AND environment = $2
		ORDER BY checked_at DESC LIMIT 1
	`, pipeline, environment)
	c, err := scanCheck(row)
	if err != nil {
		return nil, fmt.Errorf("latest compatibility check %q: %w", pipeline, err)
	}
	return c, nil
}

func scanCheck(row pgx.Row) (*storage.DBCompatibilityCheck, error) {
	var c storage.DBCompatibilityCheck
	err := row.Scan(
		&c.ID, &c.PipelineName, &c.Environment, &c.FromManifestID, &c.ToManifestID,
		&c.FromVersion, &c.ToVersion, &c.Verdict, &c.CanProceed, &c.Issues, &c.CheckedAt,
	)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}
	return &c, nil
}

// InsertRestoreEvent records a restore outcome (typically PENDING at deploy
// time, later updated by the restore sync) and returns its id.
func (s *PipelineManifestStore) InsertRestoreEvent(
	ctx context.Context,
	e storage.DBRestoreEvent,
) (int64, error) {
	row := s.pool.QueryRow(ctx, `
		INSERT INTO restore_events
			(pipeline_name, environment, cluster, jid, manifest_id, check_id,
			 bluegreen_name, outcome, error_category, restored_checkpoint_id,
			 restored_path, exception_id, detail)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12,
			COALESCE($13, '{}'::jsonb))
		RETURNING id
	`, e.PipelineName, e.Environment, e.Cluster, e.JID, e.ManifestID, e.CheckID,
		e.BlueGreenName, e.Outcome, e.ErrorCategory, e.RestoredCheckpointID,
		e.RestoredPath, e.ExceptionID, e.Detail)
	var id int64
	if err := row.Scan(&id); err != nil {
		return 0, fmt.Errorf("insert restore event %q: %w", e.PipelineName, err)
	}
	return id, nil
}

// ListPipelineSummaries returns one rollup row per (pipeline, environment),
// joining the latest manifest with its version count, the latest compatibility
// verdict, and restore-outcome tallies. A nil environment spans all
// environments. Computed in a single query so the registry index and the
// kanban verdict-join avoid an N+1 over the per-pipeline endpoints.
func (s *PipelineManifestStore) ListPipelineSummaries(
	ctx context.Context,
	environment *string,
) ([]PipelineSummaryRow, error) {
	rows, err := s.pool.Query(ctx, `
		WITH latest_manifest AS (
			SELECT DISTINCT ON (pipeline_name, environment)
				pipeline_name, environment, version, state_fingerprint, flink_version, created_at
			FROM pipeline_manifests
			WHERE ($1::text IS NULL OR environment = $1)
			ORDER BY pipeline_name, environment, version DESC
		),
		version_counts AS (
			SELECT pipeline_name, environment, COUNT(*) AS version_count
			FROM pipeline_manifests
			WHERE ($1::text IS NULL OR environment = $1)
			GROUP BY pipeline_name, environment
		),
		latest_check AS (
			SELECT DISTINCT ON (pipeline_name, environment)
				pipeline_name, environment, verdict, checked_at,
				jsonb_array_length(issues) AS issue_count
			FROM compatibility_checks
			WHERE ($1::text IS NULL OR environment = $1)
			ORDER BY pipeline_name, environment, checked_at DESC
		),
		restore_stats AS (
			SELECT pipeline_name, environment,
				COUNT(*) FILTER (WHERE outcome <> 'PENDING') AS restore_total,
				COUNT(*) FILTER (WHERE outcome = 'SUCCESS') AS restore_success
			FROM restore_events
			WHERE ($1::text IS NULL OR environment = $1)
			GROUP BY pipeline_name, environment
		)
		SELECT
			lm.pipeline_name, lm.environment, lm.version,
			COALESCE(vc.version_count, 1), lm.state_fingerprint, lm.flink_version,
			lm.created_at, lc.verdict, lc.checked_at, lc.issue_count,
			COALESCE(rs.restore_total, 0), COALESCE(rs.restore_success, 0)
		FROM latest_manifest lm
		LEFT JOIN version_counts vc USING (pipeline_name, environment)
		LEFT JOIN latest_check lc USING (pipeline_name, environment)
		LEFT JOIN restore_stats rs USING (pipeline_name, environment)
		ORDER BY lm.pipeline_name, lm.environment
	`, environment)
	if err != nil {
		return nil, fmt.Errorf("list pipeline summaries: %w", err)
	}
	defer rows.Close()

	var out []PipelineSummaryRow
	for rows.Next() {
		var r PipelineSummaryRow
		if err := rows.Scan(
			&r.PipelineName, &r.Environment, &r.LatestVersion, &r.VersionCount,
			&r.StateFingerprint, &r.FlinkVersion, &r.CreatedAt, &r.LastVerdict,
			&r.LastCheckedAt, &r.LastIssueCount, &r.RestoreTotal, &r.RestoreSuccess,
		); err != nil {
			return nil, fmt.Errorf("scan pipeline summary: %w", err)
		}
		out = append(out, r)
	}
	return out, rows.Err()
}

// RestoreEventExists reports whether a terminal restore event was already
// recorded for this job's specific restore. A restore is identified by the
// restored checkpoint id (for a SUCCESS) or the originating exception id (for
// a FAILED outcome), so the sync loop can stay idempotent across restarts
// without a unique constraint that would also have to cover the nullable
// deploy-time PENDING rows.
func (s *PipelineManifestStore) RestoreEventExists(
	ctx context.Context,
	cluster, jid string,
	restoredCheckpointID, exceptionID *int64,
) (bool, error) {
	var exists bool
	err := s.pool.QueryRow(ctx, `
		SELECT EXISTS (
			SELECT 1 FROM restore_events
			WHERE cluster = $1 AND jid = $2 AND outcome <> 'PENDING'
			  AND (
				($3::bigint IS NOT NULL AND restored_checkpoint_id = $3)
				OR ($4::bigint IS NOT NULL AND exception_id = $4)
			  )
		)
	`, cluster, jid, restoredCheckpointID, exceptionID).Scan(&exists)
	if err != nil {
		return false, fmt.Errorf("check restore event exists %q/%q: %w", cluster, jid, err)
	}
	return exists, nil
}

// ListRestoreEvents returns up to `limit` restore events for a pipeline (newest first).
func (s *PipelineManifestStore) ListRestoreEvents(
	ctx context.Context,
	pipeline, environment string,
	limit int,
) ([]storage.DBRestoreEvent, error) {
	if limit <= 0 || limit > 500 {
		limit = 100
	}
	rows, err := s.pool.Query(ctx, `
		SELECT id, pipeline_name, environment, cluster, jid, manifest_id, check_id,
		       bluegreen_name, outcome, error_category, restored_checkpoint_id,
		       restored_path, exception_id, detail, observed_at
		FROM restore_events
		WHERE pipeline_name = $1 AND environment = $2
		ORDER BY observed_at DESC LIMIT $3
	`, pipeline, environment, limit)
	if err != nil {
		return nil, fmt.Errorf("list restore events %q: %w", pipeline, err)
	}
	defer rows.Close()

	var out []storage.DBRestoreEvent
	for rows.Next() {
		var e storage.DBRestoreEvent
		if err := rows.Scan(
			&e.ID, &e.PipelineName, &e.Environment, &e.Cluster, &e.JID, &e.ManifestID,
			&e.CheckID, &e.BlueGreenName, &e.Outcome, &e.ErrorCategory,
			&e.RestoredCheckpointID, &e.RestoredPath, &e.ExceptionID, &e.Detail, &e.ObservedAt,
		); err != nil {
			return nil, fmt.Errorf("scan restore event: %w", err)
		}
		out = append(out, e)
	}
	return out, rows.Err()
}
