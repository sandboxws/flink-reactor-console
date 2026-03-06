// Package main is the entrypoint for the reactor-server binary.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
)

const (
	defaultAddr  = ":8080"
	drainTimeout = 30 * time.Second
)

func main() {
	os.Exit(run())
}

func run() int {
	logger := observability.NewLogger(slog.LevelInfo, "")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Parse cluster configuration from environment.
	configs, err := cluster.ParseClustersEnv(
		os.Getenv("CLUSTERS"),
		envOr("FLINK_REST_URL", "http://localhost:8081"),
		os.Getenv("FLINK_AUTH_TOKEN"),
		os.Getenv("SQL_GATEWAY_URL"),
	)
	if err != nil {
		logger.Error("failed to parse cluster config", "error", err)
		return 1
	}

	// Initialize the cluster manager.
	manager := &cluster.Manager{}
	if err := manager.Init(configs, logger); err != nil {
		logger.Error("failed to initialize cluster manager", "error", err)
		return 1
	}

	// Parse health check interval.
	healthInterval := 30 * time.Second
	if v := os.Getenv("HEALTH_CHECK_INTERVAL"); v != "" {
		d, err := time.ParseDuration(v)
		if err != nil {
			logger.Error("invalid HEALTH_CHECK_INTERVAL", "value", v, "error", err)
			return 1
		}
		healthInterval = d
	}

	// Start background health checks.
	manager.Start(ctx, healthInterval)

	srv := server.New(defaultAddr, logger, manager)

	// Start server in a goroutine.
	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Start(ctx)
	}()

	// Wait for shutdown signal or server error.
	select {
	case <-ctx.Done():
		logger.Info("shutdown signal received")
	case err := <-errCh:
		if err != nil {
			logger.Error("server error", "error", err)
			return 1
		}
		return 0
	}

	// Stop cluster manager (cancels health checks, stops pollers).
	manager.Stop()

	// Graceful shutdown with drain timeout.
	shutdownCtx, cancel := context.WithTimeout(context.Background(), drainTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", "error", err)
		return 1
	}

	logger.Info("server stopped")
	return 0
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
