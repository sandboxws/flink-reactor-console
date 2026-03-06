package materialized

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// mockSQLGateway sets up an HTTP test server that simulates SQL Gateway responses.
func mockSQLGateway(t *testing.T, responses map[string]any) *httptest.Server {
	t.Helper()
	return httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")

		path := r.URL.Path

		switch {
		case path == "/v3/sessions" && r.Method == http.MethodPost:
			resp := map[string]string{"sessionHandle": "test-session"}
			_ = json.NewEncoder(w).Encode(resp)

		case strings.Contains(path, "/statements") && r.Method == http.MethodPost:
			resp := map[string]string{"operationHandle": "test-op"}
			_ = json.NewEncoder(w).Encode(resp)

		case strings.Contains(path, "/result/"):
			key := "default"
			// Check which statement was submitted by looking at the response map keys
			for k, v := range responses {
				if v != nil {
					key = k
					break
				}
			}
			resp := responses[key]
			if resp == nil {
				resp = flink.SQLGatewayResultSet{
					Columns: []flink.SQLGatewayColumn{},
					Data:    []flink.SQLGatewayRow{},
				}
			}
			_ = json.NewEncoder(w).Encode(resp)

		case strings.Contains(path, "/sessions/") && r.Method == http.MethodDelete:
			w.WriteHeader(http.StatusOK)

		default:
			http.NotFound(w, r)
		}
	}))
}

func TestNewServiceNilClient(t *testing.T) {
	svc := NewService(nil)
	if svc != nil {
		t.Error("expected nil service for nil client")
	}
}

func TestListTables(t *testing.T) {
	server := mockSQLGateway(t, map[string]any{
		"default": flink.SQLGatewayResultSet{
			Columns: []flink.SQLGatewayColumn{{Name: "table_name", DataType: "STRING"}},
			Data: []flink.SQLGatewayRow{
				{Fields: []any{"user_summary"}},
				{Fields: []any{"order_totals"}},
			},
		},
	})
	defer server.Close()

	client := flink.NewClient(flink.WithBaseURL(server.URL))
	svc := NewService(client)

	tables, err := svc.ListTables(context.Background(), "paimon")
	if err != nil {
		t.Fatalf("ListTables error: %v", err)
	}

	if len(tables) != 2 {
		t.Fatalf("expected 2 tables, got %d", len(tables))
	}
	if tables[0].Name != "user_summary" {
		t.Errorf("tables[0].Name = %q, want %q", tables[0].Name, "user_summary")
	}
	if tables[1].Name != "order_totals" {
		t.Errorf("tables[1].Name = %q, want %q", tables[1].Name, "order_totals")
	}
}

func TestListTablesEmpty(t *testing.T) {
	server := mockSQLGateway(t, map[string]any{
		"default": flink.SQLGatewayResultSet{
			Columns: []flink.SQLGatewayColumn{},
			Data:    []flink.SQLGatewayRow{},
		},
	})
	defer server.Close()

	client := flink.NewClient(flink.WithBaseURL(server.URL))
	svc := NewService(client)

	tables, err := svc.ListTables(context.Background(), "")
	if err != nil {
		t.Fatalf("ListTables error: %v", err)
	}
	if len(tables) != 0 {
		t.Fatalf("expected 0 tables, got %d", len(tables))
	}
}

func TestGetTable(t *testing.T) {
	server := mockSQLGateway(t, map[string]any{
		"default": flink.SQLGatewayResultSet{
			Columns: []flink.SQLGatewayColumn{
				{Name: "key", DataType: "STRING"},
				{Name: "value", DataType: "STRING"},
			},
			Data: []flink.SQLGatewayRow{
				{Fields: []any{"refresh_status", "ACTIVATED"}},
				{Fields: []any{"refresh_mode", "CONTINUOUS"}},
				{Fields: []any{"freshness", "INTERVAL '30' SECOND"}},
				{Fields: []any{"definition", "SELECT * FROM events"}},
			},
		},
	})
	defer server.Close()

	client := flink.NewClient(flink.WithBaseURL(server.URL))
	svc := NewService(client)

	table, err := svc.GetTable(context.Background(), "user_summary", "paimon")
	if err != nil {
		t.Fatalf("GetTable error: %v", err)
	}

	if table.Name != "user_summary" {
		t.Errorf("Name = %q, want %q", table.Name, "user_summary")
	}
	if table.RefreshStatus != RefreshStatusActivated {
		t.Errorf("RefreshStatus = %q, want %q", table.RefreshStatus, RefreshStatusActivated)
	}
	if table.RefreshMode != "CONTINUOUS" {
		t.Errorf("RefreshMode = %q, want %q", table.RefreshMode, "CONTINUOUS")
	}
	if table.DefiningQuery != "SELECT * FROM events" {
		t.Errorf("DefiningQuery = %q, want %q", table.DefiningQuery, "SELECT * FROM events")
	}
}
