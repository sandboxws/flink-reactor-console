package catalogs

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// newTestSQLGatewayProviderWithInit creates a provider with an init SQL path for testing.
func newTestSQLGatewayProviderWithInit(t *testing.T, initSQLPath string, handler http.HandlerFunc) *SQLGatewayProvider {
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

	return NewSQLGatewayProvider(mgr, initSQLPath, testLogger())
}

// TestInitSQL_ExecutedOnSessionCreation verifies that init SQL DDL statements
// are submitted when a new session is created (task 4.1).
func TestInitSQL_ExecutedOnSessionCreation(t *testing.T) {
	initSQL := "CREATE CATALOG `ecom` WITH ('type' = 'generic_in_memory');\nCREATE TABLE IF NOT EXISTS `ecom`.`default`.`orders` (`id` INT);"
	tmpFile := writeInitSQLFile(t, initSQL)

	var capturedStatements []string
	p := newTestSQLGatewayProviderWithInit(t, tmpFile, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})
		case r.Method == http.MethodPost:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			capturedStatements = append(capturedStatements, body["statement"])
			writeJSON(w, map[string]string{"operationHandle": "op-1"})
		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{{Name: "name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}}},
					Data:    []flink.SQLGatewayRow{{Fields: []any{"default_catalog"}}},
				},
			})
		}
	})

	_, err := p.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// 2 init SQL statements + 1 SHOW CATALOGS = 3 total
	if len(capturedStatements) != 3 {
		t.Fatalf("expected 3 statements, got %d: %v", len(capturedStatements), capturedStatements)
	}
	if !strings.Contains(capturedStatements[0], "CREATE CATALOG") {
		t.Errorf("first statement should be init SQL CREATE CATALOG, got: %s", capturedStatements[0])
	}
	if !strings.Contains(capturedStatements[1], "CREATE TABLE") {
		t.Errorf("second statement should be init SQL CREATE TABLE, got: %s", capturedStatements[1])
	}
	if capturedStatements[2] != "SHOW CATALOGS" {
		t.Errorf("third statement should be SHOW CATALOGS, got: %s", capturedStatements[2])
	}
}

// TestInitSQL_FileNotFound verifies graceful handling when the init SQL file
// doesn't exist (task 4.2).
func TestInitSQL_FileNotFound(t *testing.T) {
	p := newTestSQLGatewayProviderWithInit(t, "/nonexistent/init.sql", func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})
		case r.Method == http.MethodPost:
			writeJSON(w, map[string]string{"operationHandle": "op-1"})
		case r.Method == http.MethodGet:
			writeJSON(w, flink.SQLGatewayResultSet{
				Results: flink.SQLGatewayResults{
					Columns: []flink.SQLGatewayColumn{{Name: "name", LogicalType: flink.SQLGatewayLogicalType{Type: "STRING"}}},
					Data:    []flink.SQLGatewayRow{{Fields: []any{"default_catalog"}}},
				},
			})
		}
	})

	catalogs, err := p.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("expected no error when init SQL file is missing, got: %v", err)
	}
	if len(catalogs) != 1 || catalogs[0].Name != "default_catalog" {
		t.Errorf("unexpected catalogs: %v", catalogs)
	}
}

// TestInitSQL_Caching verifies the init SQL file is read once across multiple
// session creations (task 4.3).
func TestInitSQL_Caching(t *testing.T) {
	initSQL := "CREATE CATALOG `test` WITH ('type' = 'generic_in_memory')"
	tmpFile := writeInitSQLFile(t, initSQL)

	var sessionCount atomic.Int32
	var initStmtCount atomic.Int32
	p := newTestSQLGatewayProviderWithInit(t, tmpFile, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			sessionCount.Add(1)
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})
		case r.Method == http.MethodPost:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			if strings.Contains(body["statement"], "CREATE CATALOG") {
				initStmtCount.Add(1)
			}
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

	// First call creates session + executes init SQL
	if _, err := p.ListCatalogs(context.Background()); err != nil {
		t.Fatal(err)
	}

	// Verify the file is read (statements cached)
	stmts := p.InitStatements()
	if len(stmts) != 1 {
		t.Fatalf("expected 1 cached init statement, got %d", len(stmts))
	}

	// Second call reuses session, no new init SQL execution
	if _, err := p.ListCatalogs(context.Background()); err != nil {
		t.Fatal(err)
	}

	if count := sessionCount.Load(); count != 1 {
		t.Errorf("expected 1 session creation, got %d", count)
	}
	if count := initStmtCount.Load(); count != 1 {
		t.Errorf("expected 1 init statement execution (cached file), got %d", count)
	}
}

// TestInitSQL_SessionRecoveryReexecutes verifies that session recovery re-executes
// init SQL on the new session (task 4.4).
func TestInitSQL_SessionRecoveryReexecutes(t *testing.T) {
	initSQL := "CREATE CATALOG `ecom` WITH ('type' = 'generic_in_memory')"
	tmpFile := writeInitSQLFile(t, initSQL)

	var sessionCount atomic.Int32
	var initStmtCount atomic.Int32
	var userStmtCount atomic.Int32
	p := newTestSQLGatewayProviderWithInit(t, tmpFile, func(w http.ResponseWriter, r *http.Request) {
		switch {
		case r.Method == http.MethodPost && r.URL.Path == "/v3/sessions":
			sessionCount.Add(1)
			writeJSON(w, map[string]string{"sessionHandle": "sess-1"})
		case r.Method == http.MethodPost:
			var body map[string]string
			_ = json.NewDecoder(r.Body).Decode(&body)
			stmt := body["statement"]
			if strings.Contains(stmt, "CREATE CATALOG") {
				initStmtCount.Add(1)
				writeJSON(w, map[string]string{"operationHandle": "op-init"})
			} else {
				n := userStmtCount.Add(1)
				if n == 1 {
					// First user statement fails with 404 (session expired)
					w.WriteHeader(http.StatusNotFound)
					writeJSON(w, map[string]any{"errors": []string{"Session not found"}})
					return
				}
				writeJSON(w, map[string]string{"operationHandle": "op-1"})
			}
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
		t.Fatalf("unexpected result: %v", catalogs)
	}

	// 2 sessions created (initial + recovery)
	if count := sessionCount.Load(); count != 2 {
		t.Errorf("expected 2 session creations, got %d", count)
	}
	// Init SQL executed once per session creation = 2 times
	if count := initStmtCount.Load(); count != 2 {
		t.Errorf("expected 2 init SQL executions (initial + recovery), got %d", count)
	}
}

// TestSplitStatements verifies the SQL splitting logic.
func TestSplitStatements(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  int
	}{
		{"empty", "", 0},
		{"single", "CREATE CATALOG test", 1},
		{"multiple", "CREATE CATALOG a; CREATE CATALOG b; CREATE TABLE t", 3},
		{"trailing semicolons", "stmt1;\nstmt2;\n", 2},
		{"whitespace only", "  ;  ;  ", 0},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			stmts := splitStatements(tt.input)
			if len(stmts) != tt.want {
				t.Errorf("splitStatements(%q) = %d statements, want %d", tt.input, len(stmts), tt.want)
			}
		})
	}
}

func writeInitSQLFile(t *testing.T, content string) string {
	t.Helper()
	dir := t.TempDir()
	path := filepath.Join(dir, "init-catalogs.sql")
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatalf("writing init SQL file: %v", err)
	}
	return path
}
