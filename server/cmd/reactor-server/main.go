// Package main is the entrypoint for the reactor-server binary.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/jackc/pgx/v5/pgxpool"
	instruments "github.com/sandboxws/flink-reactor-instruments"
	"github.com/sandboxws/flink-reactor-instruments/database"
	dlinst "github.com/sandboxws/flink-reactor-instruments/datalake"
	flussinst "github.com/sandboxws/flink-reactor-instruments/fluss"
	kafkainst "github.com/sandboxws/flink-reactor-instruments/kafka"
	redisinst "github.com/sandboxws/flink-reactor-instruments/redis"
	srinst "github.com/sandboxws/flink-reactor-instruments/schemaregistry"
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/config"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
	"github.com/sandboxws/flink-reactor/apps/server/internal/simulation"
	"github.com/sandboxws/flink-reactor/apps/server/internal/storage"
	"github.com/sandboxws/flink-reactor/apps/server/internal/store"
	bgsync "github.com/sandboxws/flink-reactor/apps/server/internal/sync"
	"github.com/sandboxws/flink-reactor/apps/server/internal/tap"
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
	registry := instruments.NewRegistry(logger, instruments.WithHealthReporter(&observability.InstrumentHealthAdapter{}))

	for _, instCfg := range cfg.Instruments {
		switch instCfg.Type {
		case "kafka":
			registry.Register(kafkainst.NewInstrument(instCfg.Name))
		case "database":
			registry.Register(database.NewInstrument(instCfg.Name, logger))
		case "redis":
			registry.Register(redisinst.NewInstrument(instCfg.Name))
		case "schemaregistry":
			registry.Register(srinst.NewInstrument(instCfg.Name))
		case "datalake":
			registry.Register(dlinst.NewInstrument(instCfg.Name))
		case "fluss":
			registry.Register(flussinst.NewInstrument(instCfg.Name))
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

	// Initialize PostgreSQL storage if enabled.
	var pool *pgxpool.Pool
	if cfg.Storage.Enabled {
		var err error
		pool, err = storage.New(ctx, cfg.Storage)
		if err != nil {
			logger.Error("failed to create storage pool", "error", err)
		} else {
			defer storage.Close(pool)

			if err := storage.Migrate(ctx, pool); err != nil {
				logger.Error("storage migration failed", "error", err)
			} else {
				logger.Info("storage enabled", "dsn_set", cfg.Storage.DSN != "")
			}
		}
	} else {
		logger.Info("storage disabled")
	}

	// Create stores and start background syncer if storage is enabled.
	var stores *store.Stores
	var syncer *bgsync.Syncer
	if pool != nil {
		stores = store.New(pool)
		syncer = bgsync.New(manager, stores, cfg.Storage.Sync, logger)
		syncer.Start(ctx)
	}

	var serverOpts []server.Option
	if cfg.SPA.StaticDir != "" {
		serverOpts = append(serverOpts, server.WithStaticDir(cfg.SPA.StaticDir))
	}
	if pool != nil {
		serverOpts = append(serverOpts, server.WithStoragePool(pool, cfg.Storage))
	}
	if stores != nil {
		serverOpts = append(serverOpts, server.WithStores(stores))
		tapStore := tap.NewStore(stores.TapManifests)
		serverOpts = append(serverOpts, server.WithTapStore(tapStore))
	}

	// Initialize simulation engine if storage is enabled.
	if pool != nil {
		simStore := simulation.NewStore(pool)
		simEngine := simulation.NewEngine(simStore, logger)
		serverOpts = append(serverOpts, server.WithSimulationEngine(simEngine))
	}

	if cfg.Flink.InitSQLPath != "" {
		serverOpts = append(serverOpts, server.WithInitSQLPath(cfg.Flink.InitSQLPath))
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

	// Stop background syncer.
	if syncer != nil {
		syncer.Stop()
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
