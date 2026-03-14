// Package main provides a CLI for managing database migrations.
//
// It loads configuration from the same YAML config files used by the server
// (config/{env}.yaml), with DSN sourced from REACTOR_STORAGE_DSN env var.
//
// Usage:
//
//	go run ./cmd/migrate [command]
//
// Commands: up, down, status, reset, version
package main

import (
	"context"
	"fmt"
	"log/slog"
	"os"

	"github.com/sandboxws/flink-reactor/apps/server/internal/config"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
)

func main() {
	os.Exit(run())
}

func run() int {
	if len(os.Args) < 2 {
		printUsage()
		return 1
	}

	command := os.Args[1]

	cfg, err := config.Load()
	if err != nil {
		fmt.Fprintf(os.Stderr, "failed to load config: %v\n", err)
		return 1
	}

	logger := observability.NewLogger(slog.LevelInfo, "")

	if !cfg.Storage.Enabled {
		logger.Error("storage is not enabled in configuration")
		return 1
	}

	if cfg.Storage.DSN == "" {
		logger.Error("storage DSN is not set (set REACTOR_STORAGE_DSN)")
		return 1
	}

	ctx := context.Background()

	pool, err := storage.New(ctx, cfg.Storage)
	if err != nil {
		logger.Error("failed to create storage pool", "error", err)
		return 1
	}
	defer storage.Close(pool)

	switch command {
	case "up":
		if err := storage.Migrate(ctx, pool); err != nil {
			logger.Error("migrate up failed", "error", err)
			return 1
		}
		logger.Info("migrations applied successfully")

	case "down":
		if err := storage.MigrateDown(ctx, pool); err != nil {
			logger.Error("migrate down failed", "error", err)
			return 1
		}
		logger.Info("rolled back one migration")

	case "status":
		if err := storage.MigrateStatus(ctx, pool); err != nil {
			logger.Error("migration status failed", "error", err)
			return 1
		}

	case "reset":
		if err := storage.MigrateReset(ctx, pool); err != nil {
			logger.Error("migrate reset failed", "error", err)
			return 1
		}
		logger.Info("all migrations rolled back")

	case "version":
		v, err := storage.MigrationVersion(ctx, pool)
		if err != nil {
			logger.Error("failed to get version", "error", err)
			return 1
		}
		if v == "" {
			fmt.Println("no migrations applied")
		} else {
			fmt.Printf("current version: %s\n", v)
		}

	default:
		fmt.Fprintf(os.Stderr, "unknown command: %s\n\n", command)
		printUsage()
		return 1
	}

	return 0
}

func printUsage() {
	fmt.Fprintln(os.Stderr, `Usage: migrate <command>

Commands:
  up       Apply all pending migrations
  down     Roll back the most recent migration
  status   Show migration status
  reset    Roll back all migrations
  version  Show current migration version

Configuration is loaded from config/{env}.yaml (env from REACTOR_ENV or APP_ENV).
Database DSN is read from REACTOR_STORAGE_DSN environment variable.`)
}
