package fluss

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// newFlussStub returns an httptest server that serves the minimum admin
// surface our Client exercises: coordinator info, databases, tables, table
// detail, tablet servers.
func newFlussStub(t *testing.T) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()

	mux.HandleFunc("/api/v1/coordinator/info", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "coord-1", "version": "0.9.0"})
	})

	mux.HandleFunc("/api/v1/databases", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"databases": []string{"benchmark", "internal"},
		})
	})

	mux.HandleFunc("/api/v1/databases/benchmark/tables", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"tables": []map[string]any{
				{
					"database":      "benchmark",
					"name":          "orders",
					"tableType":     "PrimaryKey",
					"bucketCount":   8,
					"bucketKey":     []string{"id"},
					"primaryKey":    []string{"id"},
					"lastUpdatedMs": 1700000000000,
				},
				{
					"database":      "benchmark",
					"name":          "events",
					"tableType":     "Log",
					"bucketCount":   4,
					"primaryKey":    []string{},
					"lastUpdatedMs": 1700000005000,
				},
			},
		})
	})

	mux.HandleFunc("/api/v1/databases/benchmark/tables/orders", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"database":    "benchmark",
			"name":        "orders",
			"tableType":   "PrimaryKey",
			"bucketCount": 8,
			"bucketKey":   []string{"id"},
			"primaryKey":  []string{"id"},
			"schema": []map[string]any{
				{"name": "id", "type": "BIGINT", "nullable": false},
				{"name": "region", "type": "STRING", "nullable": true, "comment": "region code"},
			},
			"properties":    map[string]string{"bucket.num": "8"},
			"lastUpdatedMs": 1700000000000,
		})
	})

	mux.HandleFunc("/api/v1/tablet-servers", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"tabletServers": []map[string]any{
				{"server": "ts-1:9124", "alive": true, "leadership": 4},
				{"server": "ts-2:9124", "alive": true, "leadership": 4},
				{"server": "ts-3:9124", "alive": false, "leadership": 0},
			},
		})
	})

	return httptest.NewServer(mux)
}

func newClientForStub(t *testing.T, srv *httptest.Server) *Client {
	t.Helper()
	c, err := NewClient(Config{
		BootstrapServers: strings.TrimPrefix(srv.URL, "http://"),
		AdminEndpoint:    srv.URL,
	})
	if err != nil {
		t.Fatalf("NewClient: %v", err)
	}
	return c
}

func TestPingCoordinator(t *testing.T) {
	srv := newFlussStub(t)
	defer srv.Close()
	c := newClientForStub(t, srv)
	if err := c.PingCoordinator(context.Background()); err != nil {
		t.Fatalf("PingCoordinator: %v", err)
	}
}

func TestListDatabases(t *testing.T) {
	srv := newFlussStub(t)
	defer srv.Close()
	c := newClientForStub(t, srv)
	got, err := c.ListDatabases(context.Background())
	if err != nil {
		t.Fatalf("ListDatabases: %v", err)
	}
	if len(got) != 2 || got[0] != "benchmark" || got[1] != "internal" {
		t.Errorf("unexpected databases: %v", got)
	}
}

func TestListTablesPrimaryKeyAndLog(t *testing.T) {
	srv := newFlussStub(t)
	defer srv.Close()
	c := newClientForStub(t, srv)
	tables, err := c.ListTables(context.Background(), "benchmark")
	if err != nil {
		t.Fatalf("ListTables: %v", err)
	}
	if len(tables) != 2 {
		t.Fatalf("want 2 tables, got %d", len(tables))
	}

	var pk, log *TableSummary
	for i := range tables {
		switch tables[i].Name {
		case "orders":
			pk = &tables[i]
		case "events":
			log = &tables[i]
		}
	}
	if pk == nil || pk.TableType != TableTypePrimaryKey {
		t.Errorf("orders should be PrimaryKey, got %+v", pk)
	}
	if len(pk.PrimaryKey) == 0 {
		t.Errorf("orders should have non-empty primaryKey, got %+v", pk.PrimaryKey)
	}
	if log == nil || log.TableType != TableTypeLog {
		t.Errorf("events should be Log, got %+v", log)
	}
	if len(log.PrimaryKey) != 0 {
		t.Errorf("events (Log) should have empty primaryKey, got %+v", log.PrimaryKey)
	}
}

func TestGetTable(t *testing.T) {
	srv := newFlussStub(t)
	defer srv.Close()
	c := newClientForStub(t, srv)
	meta, err := c.GetTable(context.Background(), "benchmark", "orders")
	if err != nil {
		t.Fatalf("GetTable: %v", err)
	}
	if meta.TableType != TableTypePrimaryKey {
		t.Errorf("TableType: want PrimaryKey, got %q", meta.TableType)
	}
	if len(meta.Schema) != 2 {
		t.Errorf("Schema: want 2 fields, got %d", len(meta.Schema))
	}
	if meta.BucketCount != 8 {
		t.Errorf("BucketCount: want 8, got %d", meta.BucketCount)
	}
}

func TestListTabletServersHealthMix(t *testing.T) {
	srv := newFlussStub(t)
	defer srv.Close()
	c := newClientForStub(t, srv)
	servers, err := c.ListTabletServers(context.Background())
	if err != nil {
		t.Fatalf("ListTabletServers: %v", err)
	}
	if len(servers) != 3 {
		t.Fatalf("want 3 servers, got %d", len(servers))
	}
	var alive, dead int
	for _, s := range servers {
		if s.Alive {
			alive++
		} else {
			dead++
		}
	}
	if alive != 2 || dead != 1 {
		t.Errorf("expected 2 alive / 1 dead, got %d / %d", alive, dead)
	}
}

func TestRejectsBadEndpoint(t *testing.T) {
	if _, err := NewClient(Config{BootstrapServers: "localhost:9123", AdminEndpoint: "not-a-url"}); err == nil {
		t.Error("expected error for malformed adminEndpoint")
	}
}

func TestHealthCheckHealthy(t *testing.T) {
	srv := newFlussStub(t)
	defer srv.Close()

	i := NewInstrument("fluss-test")
	cfg := Config{BootstrapServers: strings.TrimPrefix(srv.URL, "http://"), AdminEndpoint: srv.URL}
	cfgJSON, _ := json.Marshal(cfg)
	if err := i.Init(context.Background(), cfgJSON); err != nil {
		t.Fatalf("Init: %v", err)
	}

	if err := i.HealthCheck(context.Background()); err != nil {
		t.Fatalf("HealthCheck (healthy cluster): %v", err)
	}
}

func TestHealthCheckCoordinatorDown(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/coordinator/info", func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "down", http.StatusServiceUnavailable)
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	i := NewInstrument("fluss-test")
	cfgJSON, _ := json.Marshal(Config{BootstrapServers: strings.TrimPrefix(srv.URL, "http://"), AdminEndpoint: srv.URL})
	_ = i.Init(context.Background(), cfgJSON)

	err := i.HealthCheck(context.Background())
	if err == nil {
		t.Fatal("expected health-check failure")
	}
	var he *HealthError
	if !errors.As(err, &he) || he.Category() != HealthCoordinatorUnresponsive {
		t.Errorf("want category coordinator-unresponsive, got %v", err)
	}
}

func TestHealthCheckNoTabletServers(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/coordinator/info", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "coord-1"})
	})
	mux.HandleFunc("/api/v1/tablet-servers", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"tabletServers": []map[string]any{
				{"server": "ts-1:9124", "alive": false, "leadership": 0},
			},
		})
	})
	srv := httptest.NewServer(mux)
	defer srv.Close()

	i := NewInstrument("fluss-test")
	cfgJSON, _ := json.Marshal(Config{BootstrapServers: strings.TrimPrefix(srv.URL, "http://"), AdminEndpoint: srv.URL})
	_ = i.Init(context.Background(), cfgJSON)

	err := i.HealthCheck(context.Background())
	if err == nil {
		t.Fatal("expected health-check failure")
	}
	var he *HealthError
	if !errors.As(err, &he) || he.Category() != HealthNoTabletServers {
		t.Errorf("want category no-tablet-servers, got %v", err)
	}
}
