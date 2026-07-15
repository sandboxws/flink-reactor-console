package datalake

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// sampleTableMetadata returns a minimal but realistic Iceberg REST GET-table
// response — one schema, one partition spec, two snapshots.
func sampleTableMetadata() map[string]any {
	return map[string]any{
		"metadata": map[string]any{
			"format-version":      2,
			"table-uuid":          "11111111-2222-3333-4444-555555555555",
			"location":            "s3://bucket/db/orders",
			"last-updated-ms":     1700000000000,
			"current-snapshot-id": int64(7002),
			"current-schema-id":   1,
			"schemas": []map[string]any{{
				"schema-id":            1,
				"identifier-field-ids": []int{1},
				"fields": []map[string]any{
					{"id": 1, "name": "id", "required": true, "type": "long"},
					{"id": 2, "name": "region", "required": false, "type": "string"},
					{"id": 3, "name": "event_time", "required": false, "type": "timestamp"},
				},
			}},
			"default-spec-id": 0,
			"partition-specs": []map[string]any{{
				"spec-id": 0,
				"fields": []map[string]any{
					{"source-id": 3, "field-id": 1000, "name": "event_time_day", "transform": "day"},
					{"source-id": 2, "field-id": 1001, "name": "region", "transform": "identity"},
				},
			}},
			"snapshots": []map[string]any{
				{
					"snapshot-id":        int64(7001),
					"parent-snapshot-id": nil,
					"timestamp-ms":       1699999990000,
					"manifest-list":      "s3://bucket/.../snap-7001.avro",
					"summary":            map[string]string{"operation": "append", "total-data-files": "3", "total-files-size": "1024", "total-manifests": "1"},
				},
				{
					"snapshot-id":        int64(7002),
					"parent-snapshot-id": int64(7001),
					"timestamp-ms":       1700000000000,
					"manifest-list":      "s3://bucket/.../snap-7002.avro",
					"summary":            map[string]string{"operation": "overwrite", "total-data-files": "5", "total-files-size": "8192", "total-manifests": "2", "total-delete-files": "1"},
				},
			},
			"properties": map[string]string{"write.format.default": "parquet"},
		},
	}
}

// newIcebergStub returns a real httptest server that serves a minimal Iceberg
// REST surface: /v1/config, /v1/namespaces, /v1/namespaces/{ns}/tables, and
// /v1/namespaces/{ns}/tables/{tbl}.
func newIcebergStub(t *testing.T) *httptest.Server {
	t.Helper()
	handler := http.NewServeMux()

	handler.HandleFunc("/v1/config", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{"defaults": map[string]string{}, "overrides": map[string]string{}})
	})

	handler.HandleFunc("/v1/namespaces", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"namespaces": [][]string{{"sales"}, {"marketing"}},
		})
	})

	handler.HandleFunc("/v1/namespaces/sales/tables", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(map[string]any{
			"identifiers": []map[string]any{
				{"namespace": []string{"sales"}, "name": "orders"},
				{"namespace": []string{"sales"}, "name": "customers"},
			},
		})
	})

	handler.HandleFunc("/v1/namespaces/sales/tables/orders", func(w http.ResponseWriter, _ *http.Request) {
		_ = json.NewEncoder(w).Encode(sampleTableMetadata())
	})

	return httptest.NewServer(handler)
}

func TestIcebergPingConfig(t *testing.T) {
	srv := newIcebergStub(t)
	defer srv.Close()
	c, err := NewIcebergClient(srv.URL, nil)
	if err != nil {
		t.Fatalf("NewIcebergClient: %v", err)
	}
	if err := c.PingConfig(context.Background()); err != nil {
		t.Fatalf("PingConfig: %v", err)
	}
}

func TestIcebergListNamespaces(t *testing.T) {
	srv := newIcebergStub(t)
	defer srv.Close()
	c, _ := NewIcebergClient(srv.URL, nil)
	got, err := c.ListNamespaces(context.Background())
	if err != nil {
		t.Fatalf("ListNamespaces: %v", err)
	}
	want := []string{"sales", "marketing"}
	if len(got) != len(want) {
		t.Fatalf("expected %d namespaces, got %d (%v)", len(want), len(got), got)
	}
}

func TestIcebergListTables(t *testing.T) {
	srv := newIcebergStub(t)
	defer srv.Close()
	c, _ := NewIcebergClient(srv.URL, nil)
	got, err := c.ListTables(context.Background(), "sales")
	if err != nil {
		t.Fatalf("ListTables: %v", err)
	}
	if len(got) != 2 || got[0] != "orders" || got[1] != "customers" {
		t.Fatalf("unexpected tables: %v", got)
	}
}

func TestIcebergGetTableMetadata(t *testing.T) {
	srv := newIcebergStub(t)
	defer srv.Close()
	c, _ := NewIcebergClient(srv.URL, nil)
	meta, err := c.GetTableMetadata(context.Background(), "sales", "orders")
	if err != nil {
		t.Fatalf("GetTableMetadata: %v", err)
	}
	if meta.FormatVersion != 2 {
		t.Errorf("FormatVersion: want 2, got %d", meta.FormatVersion)
	}
	if meta.CurrentSnapshotID == nil || *meta.CurrentSnapshotID != 7002 {
		t.Errorf("CurrentSnapshotID: want 7002, got %v", meta.CurrentSnapshotID)
	}
	if len(meta.Schema.Fields) != 3 {
		t.Fatalf("Schema.Fields: want 3, got %d", len(meta.Schema.Fields))
	}
	if len(meta.Schema.PrimaryKeys) != 1 || meta.Schema.PrimaryKeys[0] != "id" {
		t.Errorf("PrimaryKeys: want [id], got %v", meta.Schema.PrimaryKeys)
	}
	if len(meta.PartitionSpec.Fields) != 2 {
		t.Errorf("PartitionSpec.Fields: want 2, got %d", len(meta.PartitionSpec.Fields))
	}
	if meta.PartitionSpec.Fields[0].Transform != "day" {
		t.Errorf("first partition transform: want day, got %s", meta.PartitionSpec.Fields[0].Transform)
	}
	if len(meta.Snapshots) != 2 {
		t.Errorf("Snapshots: want 2, got %d", len(meta.Snapshots))
	}
	if meta.Snapshots[0].Operation != "append" || meta.Snapshots[1].Operation != "overwrite" {
		t.Errorf("snapshot operations: %v / %v", meta.Snapshots[0].Operation, meta.Snapshots[1].Operation)
	}
}

func TestIcebergGetSnapshotsChronological(t *testing.T) {
	srv := newIcebergStub(t)
	defer srv.Close()
	c, _ := NewIcebergClient(srv.URL, nil)
	snaps, err := c.GetSnapshots(context.Background(), "sales", "orders")
	if err != nil {
		t.Fatalf("GetSnapshots: %v", err)
	}
	if len(snaps) < 2 || snaps[0].TimestampMs > snaps[1].TimestampMs {
		t.Errorf("snapshots not chronological: %+v", snaps)
	}
}

func TestIcebergGetStorageMetrics(t *testing.T) {
	srv := newIcebergStub(t)
	defer srv.Close()
	c, _ := NewIcebergClient(srv.URL, nil)
	m, err := c.GetStorageMetrics(context.Background(), "sales", "orders")
	if err != nil {
		t.Fatalf("GetStorageMetrics: %v", err)
	}
	if m.TotalSizeBytes != 8192 {
		t.Errorf("TotalSizeBytes: want 8192, got %d", m.TotalSizeBytes)
	}
	if m.DataFileCount != 5 {
		t.Errorf("DataFileCount: want 5, got %d", m.DataFileCount)
	}
	if m.ManifestFileCount != 2 {
		t.Errorf("ManifestFileCount: want 2, got %d", m.ManifestFileCount)
	}
	if m.DeleteFileCount != 1 {
		t.Errorf("DeleteFileCount: want 1, got %d", m.DeleteFileCount)
	}
}

func TestIcebergRejectsBadURL(t *testing.T) {
	if _, err := NewIcebergClient("", nil); err == nil {
		t.Error("expected error for empty url")
	}
	if _, err := NewIcebergClient("not-a-url", nil); err == nil {
		t.Error("expected error for malformed url")
	}
}

func TestEncodeNamespaceMultiPart(t *testing.T) {
	got := encodeNamespace("a.b.c")
	if !strings.Contains(got, "%1F") {
		t.Errorf("encodeNamespace should join with %%1F, got %q", got)
	}
}
