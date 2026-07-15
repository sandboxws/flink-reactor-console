package graphql_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/cluster"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql"
)

// setupResolverWith404 returns a resolver pointed at a mock Flink server that
// always responds with HTTP 404. Used to exercise the 404→empty fallback.
func setupResolverWith404(t *testing.T) (*graphql.Resolver, func()) {
	t.Helper()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))

	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "default", URL: srv.URL, Default: true},
	}, testLogger()); err != nil {
		srv.Close()
		t.Fatalf("cluster manager init: %v", err)
	}

	return &graphql.Resolver{Manager: mgr}, srv.Close
}

func TestJobManagerStdout_404FromFlink_ReturnsEmptyNoError(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolverWith404(t)
	defer cleanup()

	out, err := queryResolver(resolver).JobManagerStdout(context.Background(), nil)
	if err != nil {
		t.Fatalf("expected nil error on 404, got: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty string, got %q", out)
	}
}

func TestJobManagerStderr_404FromFlink_ReturnsEmptyNoError(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolverWith404(t)
	defer cleanup()

	out, err := queryResolver(resolver).JobManagerStderr(context.Background(), nil)
	if err != nil {
		t.Fatalf("expected nil error on 404, got: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty string, got %q", out)
	}
}

func TestTaskManagerStdout_404FromFlink_ReturnsEmptyNoError(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolverWith404(t)
	defer cleanup()

	out, err := queryResolver(resolver).TaskManagerStdout(context.Background(), "tm-1", nil)
	if err != nil {
		t.Fatalf("expected nil error on 404, got: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty string, got %q", out)
	}
}

func TestTaskManagerStderr_404FromFlink_ReturnsEmptyNoError(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolverWith404(t)
	defer cleanup()

	out, err := queryResolver(resolver).TaskManagerStderr(context.Background(), "tm-1", nil)
	if err != nil {
		t.Fatalf("expected nil error on 404, got: %v", err)
	}
	if out != "" {
		t.Errorf("expected empty string, got %q", out)
	}
}
