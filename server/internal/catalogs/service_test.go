package catalogs

import (
	"context"
	"encoding/json"
	"fmt"
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

// newTestSQLGatewayProvider creates a SQLGatewayProvider backed by a test HTTP server.
func newTestSQLGatewayProvider(t *testing.T, handler http.HandlerFunc) *SQLGatewayProvider {
	t.Helper()

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

	sqlServer := httptest.NewServer(handler)
	t.Cleanup(sqlServer.Close)

	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "test", URL: flinkServer.URL, SQLGatewayURL: sqlServer.URL, Default: true},
	}, testLogger()); err != nil {
		t.Fatalf("manager init: %v", err)
	}

	return NewSQLGatewayProvider(mgr, "", testLogger())
}

// ---------------------------------------------------------------------------
// SQLGatewayProvider tests
// ---------------------------------------------------------------------------

func TestSQLGatewayProvider_ListCatalogs(t *testing.T) {
	p := newTestSQLGatewayProvider(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})
		case r.Method == http.MethodPost:
			writeJSON(w, map[string]string{"operationHandle": "op-1"})
		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{{Name: "catalog name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}}},
					Data: []flink.SQLGatewayRow{
						{Fields: []any{"default_catalog"}},
						{Fields: []any{"paimon"}},
					},
				},
			})
		}
	})

	catalogs, err := p.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(catalogs) != 2 {
		t.Fatalf("expected 2 catalogs, got %d", len(catalogs))
	}
	if catalogs[0].Name != "default_catalog" {
		t.Errorf("expected 'default_catalog', got %q", catalogs[0].Name)
	}
	if catalogs[0].Source != "live" {
		t.Errorf("expected source 'live', got %q", catalogs[0].Source)
	}
}

func TestSQLGatewayProvider_ListDatabases(t *testing.T) {
	var capturedStmt string
	p := newTestSQLGatewayProvider(t, func(w http.ResponseWriter, r *http.Request) {
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
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{{Name: "database name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}}},
					Data:    []flink.SQLGatewayRow{{Fields: []any{"my_db"}}},
				},
			})
		}
	})

	dbs, err := p.ListDatabases(context.Background(), "paimon")
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

func TestSQLGatewayProvider_ListTables(t *testing.T) {
	var capturedStmt string
	p := newTestSQLGatewayProvider(t, func(w http.ResponseWriter, r *http.Request) {
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
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{{Name: "table name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}}},
					Data: []flink.SQLGatewayRow{
						{Fields: []any{"orders"}},
						{Fields: []any{"users"}},
					},
				},
			})
		}
	})

	tables, err := p.ListTables(context.Background(), "paimon", "my_db")
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

func TestSQLGatewayProvider_ListColumns(t *testing.T) {
	var capturedStmt string
	p := newTestSQLGatewayProvider(t, func(w http.ResponseWriter, r *http.Request) {
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
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{
						{Name: "column_name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}},
						{Name: "column_type", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}},
					},
					Data: []flink.SQLGatewayRow{
						{Fields: []any{"id", "INT"}},
						{Fields: []any{"name", "STRING"}},
					},
				},
			})
		}
	})

	cols, err := p.ListColumns(context.Background(), "paimon", "my_db", "orders")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(cols) != 2 {
		t.Fatalf("expected 2 columns, got %d", len(cols))
	}
	if cols[0].Name != "id" || cols[0].Type != "INT" {
		t.Errorf("unexpected column[0]: %+v", cols[0])
	}
	if capturedStmt != "DESCRIBE `paimon`.`my_db`.`orders`" {
		t.Errorf("unexpected SQL: %q", capturedStmt)
	}
}

func TestSQLGatewayProvider_SessionReuse(t *testing.T) {
	var sessionCount atomic.Int32
	p := newTestSQLGatewayProvider(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			sessionCount.Add(1)
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})
		case r.Method == http.MethodPost:
			writeJSON(w, map[string]string{"operationHandle": "op-1"})
		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{{Name: "name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}}},
					Data:    []flink.SQLGatewayRow{{Fields: []any{"test"}}},
				},
			})
		}
	})

	ctx := context.Background()
	if _, err := p.ListCatalogs(ctx); err != nil {
		t.Fatal(err)
	}
	if _, err := p.ListCatalogs(ctx); err != nil {
		t.Fatal(err)
	}

	if count := sessionCount.Load(); count != 1 {
		t.Errorf("expected 1 session creation, got %d", count)
	}
}

func TestSQLGatewayProvider_SessionRecovery(t *testing.T) {
	var sessionCount atomic.Int32
	var stmtCount atomic.Int32
	p := newTestSQLGatewayProvider(t, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			sessionCount.Add(1)
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})
		case r.Method == http.MethodPost:
			n := stmtCount.Add(1)
			if n == 1 {
				w.WriteHeader(http.StatusNotFound)
				writeJSON(w, map[string]any{"errors": []string{"Session not found"}})
				return
			}
			writeJSON(w, map[string]string{"operationHandle": "op-1"})
		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{{Name: "name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}}},
					Data:    []flink.SQLGatewayRow{{Fields: []any{"recovered"}}},
				},
			})
		}
	})

	catalogs, err := p.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(catalogs) != 1 || catalogs[0].Name != "recovered" {
		t.Fatalf("unexpected result after recovery: %+v", catalogs)
	}
	if count := sessionCount.Load(); count != 2 {
		t.Errorf("expected 2 session creations (recovery), got %d", count)
	}
}

// ---------------------------------------------------------------------------
// Service composition tests
// ---------------------------------------------------------------------------

type mockProvider struct {
	catalogs  []CatalogInfo
	databases map[string][]CatalogDatabase
	tables    map[string][]CatalogTable
	columns   map[string][]ColumnInfo
	err       error
}

func (m *mockProvider) ListCatalogs(_ context.Context) ([]CatalogInfo, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.catalogs, nil
}

func (m *mockProvider) ListDatabases(_ context.Context, catalog string) ([]CatalogDatabase, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.databases[catalog], nil
}

func (m *mockProvider) ListTables(_ context.Context, catalog, database string) ([]CatalogTable, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.tables[catalog+"."+database], nil
}

func (m *mockProvider) ListColumns(_ context.Context, catalog, database, table string) ([]ColumnInfo, error) {
	if m.err != nil {
		return nil, m.err
	}
	return m.columns[catalog+"."+database+"."+table], nil
}

func (m *mockProvider) TableDDL(_ context.Context, _, _, _ string) (string, error) {
	if m.err != nil {
		return "", m.err
	}
	return "", nil
}

func TestService_MergesProviders(t *testing.T) {
	bundled := &mockProvider{
		catalogs: []CatalogInfo{{Name: "bundled_cat", Source: "bundled"}},
		databases: map[string][]CatalogDatabase{
			"bundled_cat": {{Name: "db1"}},
		},
		tables: map[string][]CatalogTable{
			"bundled_cat.db1": {{Name: "t1"}},
		},
		columns: map[string][]ColumnInfo{
			"bundled_cat.db1.t1": {{Name: "id", Type: "INT"}},
		},
	}

	live := &mockProvider{
		catalogs: []CatalogInfo{{Name: "live_cat", Source: "live"}},
		databases: map[string][]CatalogDatabase{
			"live_cat": {{Name: "default"}},
		},
		tables: map[string][]CatalogTable{
			"live_cat.default": {{Name: "orders"}},
		},
		columns: map[string][]ColumnInfo{
			"live_cat.default.orders": {{Name: "order_id", Type: "BIGINT"}},
		},
	}

	svc := NewService(testLogger(), bundled, live)

	cats, err := svc.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("ListCatalogs() error: %v", err)
	}
	if len(cats) != 2 {
		t.Fatalf("got %d catalogs, want 2", len(cats))
	}
	if cats[0].Name != "bundled_cat" || cats[1].Name != "live_cat" {
		t.Errorf("unexpected catalog names: %v", cats)
	}

	dbs, _ := svc.ListDatabases(context.Background(), "live_cat")
	if len(dbs) != 1 || dbs[0].Name != "default" {
		t.Errorf("unexpected databases: %v", dbs)
	}

	cols, _ := svc.ListColumns(context.Background(), "live_cat", "default", "orders")
	if len(cols) != 1 || cols[0].Name != "order_id" {
		t.Errorf("unexpected columns: %v", cols)
	}
}

func TestService_BundledOnlyMode(t *testing.T) {
	bundled := &mockProvider{
		catalogs: []CatalogInfo{{Name: "example", Source: "bundled"}},
	}

	svc := NewService(testLogger(), bundled)

	cats, err := svc.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("ListCatalogs() error: %v", err)
	}
	if len(cats) != 1 || cats[0].Name != "example" {
		t.Errorf("unexpected catalogs: %v", cats)
	}
}

func TestService_ProviderErrorContinues(t *testing.T) {
	failing := &mockProvider{err: fmt.Errorf("connection refused")}
	working := &mockProvider{
		catalogs: []CatalogInfo{{Name: "ok", Source: "bundled"}},
	}

	svc := NewService(testLogger(), failing, working)

	cats, err := svc.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("ListCatalogs() error: %v", err)
	}
	if len(cats) != 1 || cats[0].Name != "ok" {
		t.Errorf("expected working provider results, got: %v", cats)
	}
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(v)
}
