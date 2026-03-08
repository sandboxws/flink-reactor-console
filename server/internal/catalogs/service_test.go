package catalogs

import (
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

// newTestService creates a Service backed by a test HTTP server.
// The handler receives all SQL Gateway requests.
func newTestService(t *testing.T, handler http.HandlerFunc) *Service {
	t.Helper()

	// Flink REST mock (for health checks, unused in catalog tests).
	flinkServer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/overview" {
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(map[string]any{
				"flink-version":   "1.20.0",
				"flink-commit":    "abc",
				"slots-total":     4,
				"slots-available": 4,
				"jobs-running":    0,
				"jobs-finished":   0,
				"jobs-cancelled":  0,
				"jobs-failed":     0,
				"taskmanagers":    1,
			})
			return
		}
		http.NotFound(w, r)
	}))
	t.Cleanup(flinkServer.Close)

	// SQL Gateway mock.
	sqlServer := httptest.NewServer(handler)
	t.Cleanup(sqlServer.Close)

	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "test", URL: flinkServer.URL, SQLGatewayURL: sqlServer.URL, Default: true},
	}, testLogger()); err != nil {
		t.Fatalf("manager init: %v", err)
	}

	return NewService(mgr)
}

func TestListCatalogs(t *testing.T) {
	svc := newTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})

		case r.Method == http.MethodPost:
			writeJSON(w, map[string]string{"operationHandle": "op-1"})

		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Columns: []flink.SQLGatewayColumn{{Name: "catalog name", DataType: "STRING"}},
				Data: []flink.SQLGatewayRow{
					{Fields: []any{"default_catalog"}},
					{Fields: []any{"paimon"}},
				},
			})
		}
	})

	catalogs, err := svc.ListCatalogs(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(catalogs) != 2 {
		t.Fatalf("expected 2 catalogs, got %d", len(catalogs))
	}
	if catalogs[0].Name != "default_catalog" {
		t.Errorf("expected 'default_catalog', got %q", catalogs[0].Name)
	}
	if catalogs[1].Name != "paimon" {
		t.Errorf("expected 'paimon', got %q", catalogs[1].Name)
	}
}

func TestListDatabases(t *testing.T) {
	var capturedStmt string
	svc := newTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})

		case r.Method == http.MethodPost:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			capturedStmt = body["statement"]
			writeJSON(w, map[string]string{"operationHandle": "op-1"})

		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Columns: []flink.SQLGatewayColumn{{Name: "database name", DataType: "STRING"}},
				Data:    []flink.SQLGatewayRow{{Fields: []any{"my_db"}}},
			})
		}
	})

	dbs, err := svc.ListDatabases(context.Background(), "paimon", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(dbs) != 1 || dbs[0].Name != "my_db" {
		t.Fatalf("unexpected databases: %+v", dbs)
	}
	if capturedStmt != "SHOW DATABASES IN `paimon`" {
		t.Errorf("unexpected SQL: %q", capturedStmt)
	}
}

func TestListTables(t *testing.T) {
	var capturedStmt string
	svc := newTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})

		case r.Method == http.MethodPost:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			capturedStmt = body["statement"]
			writeJSON(w, map[string]string{"operationHandle": "op-1"})

		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Columns: []flink.SQLGatewayColumn{{Name: "table name", DataType: "STRING"}},
				Data: []flink.SQLGatewayRow{
					{Fields: []any{"orders"}},
					{Fields: []any{"users"}},
				},
			})
		}
	})

	tables, err := svc.ListTables(context.Background(), "paimon", "my_db", nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(tables) != 2 {
		t.Fatalf("expected 2 tables, got %d", len(tables))
	}
	if capturedStmt != "SHOW TABLES IN `paimon`.`my_db`" {
		t.Errorf("unexpected SQL: %q", capturedStmt)
	}
}

func TestSessionReuse(t *testing.T) {
	var sessionCount atomic.Int32
	svc := newTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			sessionCount.Add(1)
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})

		case r.Method == http.MethodPost:
			writeJSON(w, map[string]string{"operationHandle": "op-1"})

		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Columns: []flink.SQLGatewayColumn{{Name: "name", DataType: "STRING"}},
				Data:    []flink.SQLGatewayRow{{Fields: []any{"test"}}},
			})
		}
	})

	ctx := context.Background()
	if _, err := svc.ListCatalogs(ctx, nil); err != nil {
		t.Fatal(err)
	}
	if _, err := svc.ListCatalogs(ctx, nil); err != nil {
		t.Fatal(err)
	}

	if count := sessionCount.Load(); count != 1 {
		t.Errorf("expected 1 session creation, got %d", count)
	}
}

func TestSessionRecovery(t *testing.T) {
	var sessionCount atomic.Int32
	var stmtCount atomic.Int32
	svc := newTestService(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			sessionCount.Add(1)
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})

		case r.Method == http.MethodPost:
			n := stmtCount.Add(1)
			if n == 1 {
				// First statement call returns 404 (session expired).
				w.WriteHeader(http.StatusNotFound)
				writeJSON(w, map[string]any{"errors": []string{"Session not found"}})
				return
			}
			writeJSON(w, map[string]string{"operationHandle": "op-1"})

		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Columns: []flink.SQLGatewayColumn{{Name: "name", DataType: "STRING"}},
				Data:    []flink.SQLGatewayRow{{Fields: []any{"recovered"}}},
			})
		}
	})

	catalogs, err := svc.ListCatalogs(context.Background(), nil)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(catalogs) != 1 || catalogs[0].Name != "recovered" {
		t.Fatalf("unexpected result after recovery: %+v", catalogs)
	}
	// First session + recovery session = 2.
	if count := sessionCount.Load(); count != 2 {
		t.Errorf("expected 2 session creations (recovery), got %d", count)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
