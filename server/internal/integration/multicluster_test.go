package integration

import (
	"encoding/json"
	"io"
	"log/slog"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
)

func TestIntegration_MultiCluster_DefaultRouting(t *testing.T) {
	t.Parallel()

	// Two mock Flink servers.
	primary := flink.NewMockServer()
	defer primary.Close()
	secondary := flink.NewMockServer()
	defer secondary.Close()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "primary", URL: primary.URL, Default: true},
		{Name: "secondary", URL: secondary.URL},
	}, logger); err != nil {
		t.Fatalf("manager init: %v", err)
	}

	srv := server.New(":0", logger, mgr, nil)

	// Query without cluster arg → should route to default (primary).
	resp := graphqlQuery(t, srv.Echo(), `{ jobs { id } }`)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		Jobs []struct {
			ID string `json:"id"`
		} `json:"jobs"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(data.Jobs) == 0 {
		t.Error("expected jobs from default cluster")
	}
}

func TestIntegration_MultiCluster_ExplicitRouting(t *testing.T) {
	t.Parallel()

	primary := flink.NewMockServer()
	defer primary.Close()
	secondary := flink.NewMockServer()
	defer secondary.Close()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "primary", URL: primary.URL, Default: true},
		{Name: "secondary", URL: secondary.URL},
	}, logger); err != nil {
		t.Fatalf("manager init: %v", err)
	}

	srv := server.New(":0", logger, mgr, nil)

	// Query with explicit cluster arg → should route to secondary.
	resp := graphqlQuery(t, srv.Echo(), `{ jobs(cluster: "secondary") { id } }`)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		Jobs []struct {
			ID string `json:"id"`
		} `json:"jobs"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(data.Jobs) == 0 {
		t.Error("expected jobs from secondary cluster")
	}
}

func TestIntegration_MultiCluster_UnknownCluster(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t)

	resp := graphqlQuery(t, ts.Server.Echo(), `{ jobs(cluster: "nonexistent") { id } }`)
	if len(resp.Errors) == 0 {
		t.Fatal("expected error for unknown cluster")
	}
	found := false
	for _, e := range resp.Errors {
		if contains(e.Message, "not found") {
			found = true
			break
		}
	}
	if !found {
		t.Errorf("expected 'not found' in error, got %v", resp.Errors)
	}
}

func contains(s, substr string) bool {
	return len(s) >= len(substr) && searchString(s, substr)
}

func searchString(s, substr string) bool {
	for i := 0; i <= len(s)-len(substr); i++ {
		if s[i:i+len(substr)] == substr {
			return true
		}
	}
	return false
}
