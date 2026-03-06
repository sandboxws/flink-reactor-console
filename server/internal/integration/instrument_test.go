package integration

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
)

func TestIntegration_Instruments_ListWithHealth(t *testing.T) {
	t.Parallel()

	flinkMock := flink.NewMockServer()
	defer flinkMock.Close()

	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "default", URL: flinkMock.URL, Default: true},
	}, logger); err != nil {
		t.Fatalf("manager init: %v", err)
	}

	// Set up a registry with a mock instrument.
	registry := instruments.NewRegistry(logger)
	registry.Register(&testInstrument{name: "test-kafka", instType: "kafka"})
	_ = registry.InitAll(context.Background(), []instruments.InstrumentConfig{
		{Name: "test-kafka", Config: json.RawMessage(`{}`)},
	})

	srv := server.New(":0", logger, mgr, registry)

	// Query instruments.
	resp := graphqlQuery(t, srv.Echo(), `{ instruments { name displayName type version healthy capabilities } }`)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		Instruments []struct {
			Name         string   `json:"name"`
			DisplayName  string   `json:"displayName"`
			Type         string   `json:"type"`
			Version      string   `json:"version"`
			Healthy      bool     `json:"healthy"`
			Capabilities []string `json:"capabilities"`
		} `json:"instruments"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}

	if len(data.Instruments) != 1 {
		t.Fatalf("expected 1 instrument, got %d", len(data.Instruments))
	}

	inst := data.Instruments[0]
	if inst.Name != "test-kafka" {
		t.Errorf("expected name 'test-kafka', got %q", inst.Name)
	}
	if inst.Type != "kafka" {
		t.Errorf("expected type 'kafka', got %q", inst.Type)
	}
	if !inst.Healthy {
		t.Error("expected instrument to be healthy")
	}
	if len(inst.Capabilities) == 0 {
		t.Error("expected at least one capability")
	}
}

func TestIntegration_Instruments_EmptyRegistry(t *testing.T) {
	t.Parallel()
	ts := newTestServer(t)

	resp := graphqlQuery(t, ts.Server.Echo(), `{ instruments { name } }`)
	if len(resp.Errors) > 0 {
		t.Fatalf("unexpected errors: %v", resp.Errors)
	}

	var data struct {
		Instruments []struct {
			Name string `json:"name"`
		} `json:"instruments"`
	}
	if err := json.Unmarshal(resp.Data, &data); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if len(data.Instruments) != 0 {
		t.Errorf("expected 0 instruments, got %d", len(data.Instruments))
	}
}

// testInstrument implements instruments.Instrument for integration tests.
type testInstrument struct {
	name     string
	instType string
}

func (m *testInstrument) Name() string                                    { return m.name }
func (m *testInstrument) DisplayName() string                             { return m.name }
func (m *testInstrument) Version() string                                 { return "0.1.0" }
func (m *testInstrument) Type() string                                    { return m.instType }
func (m *testInstrument) Init(_ context.Context, _ json.RawMessage) error { return nil }
func (m *testInstrument) Shutdown(_ context.Context) error                { return nil }
func (m *testInstrument) HealthCheck(_ context.Context) error             { return nil }
func (m *testInstrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{instruments.CapabilityBrowse}
}

func (m *testInstrument) HighlightResources(_ context.Context, _ string) ([]instruments.ResourceRef, error) {
	return nil, nil
}
