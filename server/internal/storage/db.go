// Package storage provides PostgreSQL connection pool management, embedded
// migration execution, and DB model types for the reactor-server historical
// data store.
package storage

import (
	"context"
	"fmt"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/sandboxws/flink-reactor/apps/server/internal/config"
)

// New creates a pgxpool connection pool from the given StorageConfig.
func New(ctx context.Context, cfg config.StorageConfig) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DSN)
	if err != nil {
		return nil, fmt.Errorf("parsing storage DSN: %w", err)
	}

	poolCfg.MaxConns = cfg.Pool.MaxConns
	poolCfg.MinConns = cfg.Pool.MinConns
	poolCfg.MaxConnLifetime = cfg.Pool.MaxConnLife
	poolCfg.MaxConnIdleTime = cfg.Pool.MaxConnIdle

	pool, err := pgxpool.NewWithConfig(ctx, poolCfg)
	if err != nil {
		return nil, fmt.Errorf("creating connection pool: %w", err)
	}

	return pool, nil
}

// HealthCheck verifies the pool can reach the database.
func HealthCheck(ctx context.Context, pool *pgxpool.Pool) error {
	var n int
	if err := pool.QueryRow(ctx, "SELECT 1").Scan(&n); err != nil {
		return fmt.Errorf("storage health check: %w", err)
	}
	return nil
}

// Close shuts down the connection pool.
func Close(pool *pgxpool.Pool) {
	pool.Close()
}
