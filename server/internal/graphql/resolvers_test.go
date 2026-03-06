package graphql_test

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/generated"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments"
)

// testLogger returns a silent logger for tests.
func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// setupResolver creates a Resolver backed by a mock Flink server and cluster Manager.
func setupResolver(t *testing.T) (*graphql.Resolver, func()) {
	t.Helper()

	srv := flink.NewMockServer()

	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "default", URL: srv.URL, Default: true},
	}, testLogger()); err != nil {
		t.Fatalf("cluster manager init: %v", err)
	}

	resolver := &graphql.Resolver{
		Manager: mgr,
	}

	return resolver, srv.Close
}

// queryResolver returns the Query resolver from the Resolver.
func queryResolver(r *graphql.Resolver) generated.QueryResolver {
	return r.Query()
}

func TestJobs_ReturnsCorrectCount(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	jobs, err := queryResolver(resolver).Jobs(context.Background(), nil)
	if err != nil {
		t.Fatalf("Jobs() returned error: %v", err)
	}

	// MockJobsOverview returns 6 jobs.
	if len(jobs) != 6 {
		t.Errorf("expected 6 jobs, got %d", len(jobs))
	}
}

func TestJobs_HasExpectedFields(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	jobs, err := queryResolver(resolver).Jobs(context.Background(), nil)
	if err != nil {
		t.Fatalf("Jobs() returned error: %v", err)
	}

	if len(jobs) == 0 {
		t.Fatal("expected at least one job")
	}

	first := jobs[0]
	if first.ID == "" {
		t.Error("expected job ID to be non-empty")
	}
	if first.Name == "" {
		t.Error("expected job Name to be non-empty")
	}
	if first.State == "" {
		t.Error("expected job State to be non-empty")
	}
	if first.Tasks == nil {
		t.Error("expected job Tasks to be non-nil")
	}
}

func TestJobs_ContainsRunningJob(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	jobs, err := queryResolver(resolver).Jobs(context.Background(), nil)
	if err != nil {
		t.Fatalf("Jobs() returned error: %v", err)
	}

	var foundRunning bool
	for _, j := range jobs {
		if j.State == "RUNNING" {
			foundRunning = true
			break
		}
	}
	if !foundRunning {
		t.Error("expected at least one RUNNING job")
	}
}

func TestTaskManagers_ReturnsCorrectCount(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	tms, err := queryResolver(resolver).TaskManagers(context.Background(), nil)
	if err != nil {
		t.Fatalf("TaskManagers() returned error: %v", err)
	}

	// MockTaskManagers returns 4 TMs.
	if len(tms) != 4 {
		t.Errorf("expected 4 task managers, got %d", len(tms))
	}
}

func TestTaskManagers_HasExpectedFields(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	tms, err := queryResolver(resolver).TaskManagers(context.Background(), nil)
	if err != nil {
		t.Fatalf("TaskManagers() returned error: %v", err)
	}

	if len(tms) == 0 {
		t.Fatal("expected at least one task manager")
	}

	first := tms[0]
	if first.ID == "" {
		t.Error("expected TM ID to be non-empty")
	}
	if first.Path == "" {
		t.Error("expected TM Path to be non-empty")
	}
	if first.SlotsNumber == 0 {
		t.Error("expected TM SlotsNumber to be non-zero")
	}
	if first.DataPort == 0 {
		t.Error("expected TM DataPort to be non-zero")
	}
}

func TestDashboardConfig_ReturnsClusters(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	cfg, err := queryResolver(resolver).DashboardConfig(context.Background())
	if err != nil {
		t.Fatalf("DashboardConfig() returned error: %v", err)
	}

	if len(cfg.Clusters) != 1 {
		t.Errorf("expected 1 cluster, got %d", len(cfg.Clusters))
	}
	if cfg.Clusters[0] != "default" {
		t.Errorf("expected cluster name 'default', got %q", cfg.Clusters[0])
	}
}

func TestDashboardConfig_WithInstruments(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	// Set up an instrument registry with a mock instrument.
	registry := instruments.NewRegistry(testLogger())
	registry.Register(&mockInstrument{name: "test-kafka"})
	_ = registry.InitAll(context.Background(), []instruments.InstrumentConfig{
		{Name: "test-kafka", Config: json.RawMessage(`{}`)},
	})
	resolver.InstrumentRegistry = registry

	cfg, err := queryResolver(resolver).DashboardConfig(context.Background())
	if err != nil {
		t.Fatalf("DashboardConfig() returned error: %v", err)
	}

	if len(cfg.Instruments) != 1 {
		t.Errorf("expected 1 instrument, got %d", len(cfg.Instruments))
	}
	if len(cfg.Instruments) > 0 && cfg.Instruments[0] != "test-kafka" {
		t.Errorf("expected instrument name 'test-kafka', got %q", cfg.Instruments[0])
	}
}

func TestDashboardConfig_NilManager(t *testing.T) {
	t.Parallel()
	resolver := &graphql.Resolver{}

	cfg, err := queryResolver(resolver).DashboardConfig(context.Background())
	if err != nil {
		t.Fatalf("DashboardConfig() returned error: %v", err)
	}

	if cfg.Clusters != nil {
		t.Errorf("expected nil clusters with nil manager, got %v", cfg.Clusters)
	}
	if cfg.Instruments != nil {
		t.Errorf("expected nil instruments with nil registry, got %v", cfg.Instruments)
	}
}

func TestFlinkConfig_ReturnsVersion(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	cfg, err := queryResolver(resolver).FlinkConfig(context.Background(), nil)
	if err != nil {
		t.Fatalf("FlinkConfig() returned error: %v", err)
	}

	if cfg.FlinkVersion != "1.20.0" {
		t.Errorf("expected Flink version '1.20.0', got %q", cfg.FlinkVersion)
	}
	if cfg.FlinkRevision == "" {
		t.Error("expected FlinkRevision to be non-empty")
	}
}

func TestFlinkConfig_HasFeatures(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	cfg, err := queryResolver(resolver).FlinkConfig(context.Background(), nil)
	if err != nil {
		t.Fatalf("FlinkConfig() returned error: %v", err)
	}

	if cfg.Features == nil {
		t.Fatal("expected Features to be non-nil")
	}
	if !cfg.Features.WebSubmit {
		t.Error("expected WebSubmit to be true")
	}
	if !cfg.Features.WebCancel {
		t.Error("expected WebCancel to be true")
	}
}

func TestJobs_NilManager_ReturnsError(t *testing.T) {
	t.Parallel()
	resolver := &graphql.Resolver{}

	_, err := queryResolver(resolver).Jobs(context.Background(), nil)
	if err == nil {
		t.Error("expected error when Manager is nil")
	}
}

// mockInstrument implements instruments.Instrument for testing.
type mockInstrument struct {
	name string
}

func (m *mockInstrument) Name() string        { return m.name }
func (m *mockInstrument) DisplayName() string { return m.name }
func (m *mockInstrument) Version() string     { return "0.1.0" }
func (m *mockInstrument) Type() string        { return "kafka" }
func (m *mockInstrument) Init(_ context.Context, _ json.RawMessage) error {
	return nil
}
func (m *mockInstrument) Shutdown(_ context.Context) error    { return nil }
func (m *mockInstrument) HealthCheck(_ context.Context) error { return nil }
func (m *mockInstrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{instruments.CapabilityBrowse}
}

func (m *mockInstrument) HighlightResources(_ context.Context, _ string) ([]instruments.ResourceRef, error) {
	return nil, nil
}
