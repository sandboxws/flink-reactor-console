// Package main is the entrypoint for the reactor-server binary.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/config"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments/database"
	kafkainst "github.com/sandboxws/flink-reactor/apps/server/internal/instruments/kafka"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
)

func main() {
	os.Exit(run())
}

func run() int {
	// Load centralized configuration.
	cfg, err := config.Load()
	if err != nil {
		// Use a basic logger since config-driven logger isn't available yet.
		observability.NewLogger(slog.LevelError, "").Error("failed to load config", "error", err)
		return 1
	}

	logger := observability.NewLogger(cfg.LogLevel(), "")

	// Register Prometheus metrics.
	observability.RegisterMetrics()

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	// Initialize the cluster manager from config.
	manager := &cluster.Manager{}
	if err := manager.Init(cfg.Clusters, logger); err != nil {
		logger.Error("failed to initialize cluster manager", "error", err)
		return 1
	}

	// Start background health checks.
	manager.Start(ctx, cfg.Health.Interval)

	// Initialize instrument registry.
	registry := instruments.NewRegistry(logger)

	for _, instCfg := range cfg.Instruments {
		switch instCfg.Type {
		case "kafka":
			registry.Register(kafkainst.NewInstrument(instCfg.Name))
		case "database":
			registry.Register(database.NewInstrument(instCfg.Name, logger))
		default:
			logger.Warn("unknown instrument type", "type", instCfg.Type, "name", instCfg.Name)
		}
	}

	if len(cfg.Instruments) > 0 {
		if err := registry.InitAll(ctx, cfg.Instruments); err != nil {
			logger.Error("instrument init failed", "error", err)
		}
		registry.StartHealthChecks(ctx, cfg.Health.Interval)
	}

	var serverOpts []server.Option
	if cfg.SPA.StaticDir != "" {
		serverOpts = append(serverOpts, server.WithStaticDir(cfg.SPA.StaticDir))
	}

	srv := server.New(cfg.Address(), logger, manager, registry, serverOpts...)

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
	shutdownCtx, cancel := context.WithTimeout(context.Background(), cfg.Server.DrainTimeout)
	defer cancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("shutdown error", "error", err)
		return 1
	}

	logger.Info("server stopped")
	return 0
}
