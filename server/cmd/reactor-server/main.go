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
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments/database"
	kafkainst "github.com/sandboxws/flink-reactor/apps/server/internal/instruments/kafka"
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

	// Initialize instrument registry.
	registry := instruments.NewRegistry(logger)

	instConfigs, err := instruments.ParseInstrumentsEnv(os.Getenv("INSTRUMENTS"))
	if err != nil {
		logger.Error("invalid INSTRUMENTS config", "error", err)
		// Continue with empty registry — instruments are optional.
		instConfigs = nil
	}

	// Register instrument types and create instances from config.
	for _, cfg := range instConfigs {
		switch cfg.Type {
		case "kafka":
			registry.Register(kafkainst.NewInstrument(cfg.Name))
		case "database":
			registry.Register(database.NewInstrument(cfg.Name, logger))
		default:
			logger.Warn("unknown instrument type", "type", cfg.Type, "name", cfg.Name)
		}
	}

	if len(instConfigs) > 0 {
		if err := registry.InitAll(ctx, instConfigs); err != nil {
			logger.Error("instrument init failed", "error", err)
		}
		registry.StartHealthChecks(ctx, healthInterval)
	}

	var serverOpts []server.Option
	if staticDir := os.Getenv("STATIC_DIR"); staticDir != "" {
		serverOpts = append(serverOpts, server.WithStaticDir(staticDir))
	}

	srv := server.New(defaultAddr, logger, manager, registry, serverOpts...)

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

	// Shutdown instruments.
	registry.ShutdownAll(context.Background())

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
