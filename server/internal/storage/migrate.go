package storage

import (
	"context"
	"database/sql"
	"embed"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func init() {
	goose.SetBaseFS(migrationFS)
}

// Migrate applies all pending migrations using goose.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	db, err := gooseDB(pool)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := goose.UpContext(ctx, db, "migrations"); err != nil {
		return fmt.Errorf("running migrations: %w", err)
	}
	return nil
}

// MigrationVersion returns the current migration version, or an empty string
// if no migrations have been applied.
func MigrationVersion(ctx context.Context, pool *pgxpool.Pool) (string, error) {
	db, err := gooseDB(pool)
	if err != nil {
		return "", err
	}
	defer db.Close()

	version, err := goose.GetDBVersionContext(ctx, db)
	if err != nil {
		return "", fmt.Errorf("querying migration version: %w", err)
	}
	if version == 0 {
		return "", nil
	}
	return fmt.Sprintf("%03d", version), nil
}

// MigrateDown rolls back the most recent migration.
func MigrateDown(ctx context.Context, pool *pgxpool.Pool) error {
	db, err := gooseDB(pool)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := goose.DownContext(ctx, db, "migrations"); err != nil {
		return fmt.Errorf("rolling back migration: %w", err)
	}
	return nil
}

// MigrateReset rolls back all migrations.
func MigrateReset(ctx context.Context, pool *pgxpool.Pool) error {
	db, err := gooseDB(pool)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := goose.ResetContext(ctx, db, "migrations"); err != nil {
		return fmt.Errorf("resetting migrations: %w", err)
	}
	return nil
}

// MigrateStatus prints migration status to stdout.
func MigrateStatus(ctx context.Context, pool *pgxpool.Pool) error {
	db, err := gooseDB(pool)
	if err != nil {
		return err
	}
	defer db.Close()

	if err := goose.StatusContext(ctx, db, "migrations"); err != nil {
		return fmt.Errorf("migration status: %w", err)
	}
	return nil
}

// gooseDB creates a *sql.DB from the pgxpool for goose compatibility.
func gooseDB(pool *pgxpool.Pool) (*sql.DB, error) {
	db := stdlib.OpenDBFromPool(pool)
	if err := db.Ping(); err != nil {
		db.Close()
		return nil, fmt.Errorf("pinging database for migrations: %w", err)
	}
	return db, nil
}
