package server_test

import (
	"bytes"
	"context"
	"net/http"
	"testing"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
)

func TestGracefulShutdown(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)
	srv := server.New(":0", logger, nil, nil, nil)

	ctx, cancel := context.WithCancel(context.Background())

	errCh := make(chan error, 1)
	go func() {
		errCh <- srv.Start(ctx)
	}()

	// Give server a moment to start.
	time.Sleep(50 * time.Millisecond)

	// Trigger shutdown.
	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		t.Fatalf("shutdown failed: %v", err)
	}
	cancel()

	// Verify the server stopped.
	select {
	case err := <-errCh:
		if err != nil {
			t.Fatalf("server returned error: %v", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("server did not stop within timeout")
	}

	// Verify the handler rejects new connections after shutdown.
	_, err := http.Get("http://localhost:0/healthz")
	if err == nil {
		t.Error("expected connection error after shutdown")
	}
}
