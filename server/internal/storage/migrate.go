package storage

import (
	"context"
	"embed"
	"fmt"
	"path/filepath"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

// Migrate applies all pending up-migrations in sequential order. It creates a
// schema_migrations tracking table if it doesn't exist and skips migrations
// that have already been applied.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	// Ensure tracking table exists.
	if _, err := pool.Exec(ctx, `
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version TEXT PRIMARY KEY,
			applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
		)
	`); err != nil {
		return fmt.Errorf("creating schema_migrations table: %w", err)
	}

	// Discover embedded up-migration files.
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return fmt.Errorf("reading embedded migrations: %w", err)
	}

	var upFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".up.sql") {
			upFiles = append(upFiles, e.Name())
		}
	}
	sort.Strings(upFiles)

	// Load already-applied versions.
	applied := make(map[string]bool)
	rows, err := pool.Query(ctx, "SELECT version FROM schema_migrations")
	if err != nil {
		return fmt.Errorf("querying applied migrations: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var v string
		if err := rows.Scan(&v); err != nil {
			return fmt.Errorf("scanning migration version: %w", err)
		}
		applied[v] = true
	}
	if err := rows.Err(); err != nil {
		return fmt.Errorf("iterating migration rows: %w", err)
	}

	// Apply unapplied migrations in order.
	for _, name := range upFiles {
		version := strings.TrimSuffix(name, ".up.sql")
		if applied[version] {
			continue
		}

		sql, err := migrationFS.ReadFile(filepath.Join("migrations", name))
		if err != nil {
			return fmt.Errorf("reading migration %s: %w", name, err)
		}

		tx, err := pool.Begin(ctx)
		if err != nil {
			return fmt.Errorf("beginning transaction for %s: %w", version, err)
		}

		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("applying migration %s: %w", version, err)
		}

		if _, err := tx.Exec(ctx, "INSERT INTO schema_migrations (version) VALUES ($1)", version); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("recording migration %s: %w", version, err)
		}

		if err := tx.Commit(ctx); err != nil {
			return fmt.Errorf("committing migration %s: %w", version, err)
		}
	}

	return nil
}

// MigrationVersion returns the latest applied migration version, or an empty
// string if no migrations have been applied.
func MigrationVersion(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	var version string
	err := pool.QueryRow(ctx, "SELECT COALESCE(MAX(version), '') FROM schema_migrations").Scan(&version)
	if err != nil {
		return "", fmt.Errorf("querying migration version: %w", err)
	}
	return version, nil
}
