package cluster

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// newMockFlinkServer returns a test server that responds to GET /overview
// with the given version string (or an error if version is empty).
func newMockFlinkServer(version string) *httptest.Server {
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/overview" {
			if version == "" {
				http.Error(w, "unavailable", http.StatusServiceUnavailable)
				return
			}
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"flink-version":   version,
				"flink-commit":    "abc123",
				"slots-total":     4,
				"slots-available": 2,
				"jobs-running":    1,
				"jobs-finished":   0,
				"jobs-cancelled":  0,
				"jobs-failed":     0,
				"taskmanagers":    2,
			})
			return
		}
		// Default: return 404 for other paths.
		http.NotFound(w, r)
	}))
}

func TestInit_SingleCluster(t *testing.T) {
	m := &Manager{}
	err := m.Init([]Config{
		{Name: "default", URL: "http://localhost:8081", Default: true},
	}, testLogger())
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if m.defaultName != "default" {
		t.Errorf("expected default name 'default', got %q", m.defaultName)
	}
	if len(m.connections) != 1 {
		t.Errorf("expected 1 connection, got %d", len(m.connections))
	}
}

func TestInit_MultiCluster(t *testing.T) {
	m := &Manager{}
	err := m.Init([]Config{
		{Name: "dev", URL: "http://flink-dev:8081"},
		{Name: "prod", URL: "http://flink-prod:8081", Default: true},
	}, testLogger())
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if m.defaultName != "prod" {
		t.Errorf("expected default 'prod', got %q", m.defaultName)
	}
	if len(m.connections) != 2 {
		t.Errorf("expected 2 connections, got %d", len(m.connections))
	}
}

func TestInit_EmptyConfig(t *testing.T) {
	m := &Manager{}
	err := m.Init([]Config{}, testLogger())
	if err == nil {
		t.Error("expected error for empty config")
	}
}

func TestInit_NoExplicitDefault(t *testing.T) {
	m := &Manager{}
	err := m.Init([]Config{
		{Name: "first", URL: "http://a:8081"},
		{Name: "second", URL: "http://b:8081"},
	}, testLogger())
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if m.defaultName != "first" {
		t.Errorf("expected default 'first', got %q", m.defaultName)
	}
}

func TestInit_MultipleDefaultsWarning(t *testing.T) {
	var logBuf strings.Builder
	logger := slog.New(slog.NewTextHandler(&logBuf, &slog.HandlerOptions{Level: slog.LevelWarn}))

	m := &Manager{}
	err := m.Init([]Config{
		{Name: "a", URL: "http://a:8081", Default: true},
		{Name: "b", URL: "http://b:8081", Default: true},
	}, logger)
	if err != nil {
		t.Fatalf("Init failed: %v", err)
	}
	if m.defaultName != "a" {
		t.Errorf("expected default 'a', got %q", m.defaultName)
	}
	if !strings.Contains(logBuf.String(), "multiple clusters marked as default") {
		t.Error("expected warning about multiple defaults in logs")
	}
}

func TestResolve_ExplicitName(t *testing.T) {
	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "dev", URL: "http://dev:8081"},
		{Name: "prod", URL: "http://prod:8081", Default: true},
	}, testLogger())

	name := "dev"
	conn, err := m.Resolve(&name)
	if err != nil {
		t.Fatalf("Resolve failed: %v", err)
	}
	if conn.Name != "dev" {
		t.Errorf("expected 'dev', got %q", conn.Name)
	}
}

func TestResolve_NilDefault(t *testing.T) {
	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "prod", URL: "http://prod:8081", Default: true},
	}, testLogger())

	conn, err := m.Resolve(nil)
	if err != nil {
		t.Fatalf("Resolve failed: %v", err)
	}
	if conn.Name != "prod" {
		t.Errorf("expected 'prod', got %q", conn.Name)
	}
}

func TestResolve_UnknownName(t *testing.T) {
	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "prod", URL: "http://prod:8081", Default: true},
	}, testLogger())

	name := "nonexistent"
	_, err := m.Resolve(&name)
	if err == nil {
		t.Error("expected error for unknown cluster")
	}
	if !strings.Contains(err.Error(), "not found") {
		t.Errorf("expected 'not found' in error, got %q", err.Error())
	}
}

func TestHealthCheck_Healthy(t *testing.T) {
	srv := newMockFlinkServer("1.20.0")
	defer srv.Close()

	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "test", URL: srv.URL, Default: true},
	}, testLogger())

	m.HealthCheck(context.Background())

	conn := m.Default()
	if conn.Status() != StatusHealthy {
		t.Errorf("expected HEALTHY, got %v", conn.Status())
	}
	if conn.Version() != "1.20.0" {
		t.Errorf("expected version '1.20.0', got %q", conn.Version())
	}
	if conn.LastCheckTime().IsZero() {
		t.Error("expected lastCheckTime to be set")
	}
}

func TestHealthCheck_Unhealthy(t *testing.T) {
	srv := newMockFlinkServer("") // empty version triggers 503
	defer srv.Close()

	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "test", URL: srv.URL, Default: true},
	}, testLogger())

	m.HealthCheck(context.Background())

	conn := m.Default()
	if conn.Status() != StatusUnhealthy {
		t.Errorf("expected UNHEALTHY, got %v", conn.Status())
	}
}

func TestHealthCheck_MixedClusters(t *testing.T) {
	healthy := newMockFlinkServer("2.0.0")
	defer healthy.Close()
	unhealthy := newMockFlinkServer("")
	defer unhealthy.Close()

	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "good", URL: healthy.URL, Default: true},
		{Name: "bad", URL: unhealthy.URL},
	}, testLogger())

	m.HealthCheck(context.Background())

	good, _ := m.Get("good")
	bad, _ := m.Get("bad")

	if good.Status() != StatusHealthy {
		t.Errorf("expected good=HEALTHY, got %v", good.Status())
	}
	if bad.Status() != StatusUnhealthy {
		t.Errorf("expected bad=UNHEALTHY, got %v", bad.Status())
	}
}

func TestList(t *testing.T) {
	srv := newMockFlinkServer("1.20.0")
	defer srv.Close()

	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "prod", URL: srv.URL, Default: true},
	}, testLogger())

	// Before health check — status should be UNKNOWN.
	infos := m.List()
	if len(infos) != 1 {
		t.Fatalf("expected 1 cluster info, got %d", len(infos))
	}
	if infos[0].Name != "prod" {
		t.Errorf("expected name 'prod', got %q", infos[0].Name)
	}
	if infos[0].Status != StatusUnknown {
		t.Errorf("expected UNKNOWN before health check, got %v", infos[0].Status)
	}

	// After health check.
	m.HealthCheck(context.Background())

	infos = m.List()
	if infos[0].Status != StatusHealthy {
		t.Errorf("expected HEALTHY after health check, got %v", infos[0].Status)
	}
	if infos[0].Version == nil || *infos[0].Version != "1.20.0" {
		t.Error("expected version '1.20.0' after health check")
	}
	if infos[0].LastCheckTime == nil {
		t.Error("expected lastCheckTime to be set after health check")
	}
}

func TestStartStop(t *testing.T) {
	srv := newMockFlinkServer("1.20.0")
	defer srv.Close()

	m := &Manager{}
	_ = m.Init([]Config{
		{Name: "test", URL: srv.URL, Default: true},
	}, testLogger())

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	m.Start(ctx, 50*time.Millisecond)

	// Initial health check should have run synchronously.
	if m.Default().Status() != StatusHealthy {
		t.Error("expected HEALTHY after Start")
	}

	m.Stop()
}
