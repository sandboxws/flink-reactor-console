// Package main is the entrypoint for the reactor-server binary.
package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
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

	// Flink REST client and service.
	flinkURL := envOr("FLINK_REST_URL", "http://localhost:8081")
	clientOpts := []flink.ClientOption{
		flink.WithBaseURL(flinkURL),
		flink.WithLogger(logger),
	}
	if token := os.Getenv("FLINK_AUTH_TOKEN"); token != "" {
		clientOpts = append(clientOpts, flink.WithBearerAuth(token))
	}
	flinkClient := flink.NewClient(clientOpts...)
	service := flink.NewService(flinkClient)

	// Job status poller.
	poller := flink.NewPoller(service, flink.WithPollerLogger(logger))

	// SQL Gateway client (optional, separate base URL).
	var sqlClient *flink.Client
	if sqlURL := os.Getenv("SQL_GATEWAY_URL"); sqlURL != "" {
		sqlOpts := []flink.ClientOption{
			flink.WithBaseURL(sqlURL),
			flink.WithLogger(logger),
		}
		if token := os.Getenv("FLINK_AUTH_TOKEN"); token != "" {
			sqlOpts = append(sqlOpts, flink.WithBearerAuth(token))
		}
		sqlClient = flink.NewClient(sqlOpts...)
	}

	srv := server.New(defaultAddr, logger, service, poller, sqlClient)

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

	// Stop poller before draining HTTP connections.
	poller.Stop()

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
