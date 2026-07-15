package datalake

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

// buildPaimonTable creates a minimal Paimon table layout under root and
// returns the warehouse path.
func buildPaimonTable(t *testing.T, db, table string, schema map[string]any, snapshots []map[string]any) string {
	t.Helper()
	warehouse := t.TempDir()
	tbl := filepath.Join(warehouse, db+".db", table)
	if err := os.MkdirAll(filepath.Join(tbl, "schema"), 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Join(tbl, "snapshot"), 0o750); err != nil {
		t.Fatal(err)
	}

	if schema != nil {
		data, _ := json.Marshal(schema)
		if err := os.WriteFile(filepath.Join(tbl, "schema", "schema-0"), data, 0o600); err != nil {
			t.Fatal(err)
		}
	}

	for i, s := range snapshots {
		data, _ := json.Marshal(s)
		path := filepath.Join(tbl, "snapshot", "snapshot-"+itoa(i+1))
		if err := os.WriteFile(path, data, 0o600); err != nil {
			t.Fatal(err)
		}
	}
	return warehouse
}

func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var b [20]byte
	pos := len(b)
	for n > 0 {
		pos--
		b[pos] = byte('0' + n%10)
		n /= 10
	}
	return string(b[pos:])
}

func samplePaimonSchema() map[string]any {
	return map[string]any{
		"id": 0,
		"fields": []map[string]any{
			{"id": 0, "name": "user_id", "type": "BIGINT NOT NULL"},
			{"id": 1, "name": "name", "type": "STRING"},
			{"id": 2, "name": "country", "type": "STRING"},
		},
		"highestFieldId": 2,
		"partitionKeys":  []string{"country"},
		"primaryKeys":    []string{"user_id"},
		"options": map[string]string{
			"bucket":             "4",
			"changelog-producer": "input",
			"merge-engine":       "deduplicate",
			"file.format":        "orc",
		},
		"comment":    "user dim",
		"timeMillis": 1700000000000,
	}
}

func TestPaimonGetTableSchema(t *testing.T) {
	wh := buildPaimonTable(t, "sales", "users", samplePaimonSchema(), nil)
	c, err := NewPaimonClient(wh)
	if err != nil {
		t.Fatalf("NewPaimonClient: %v", err)
	}
	got, err := c.GetTableSchema(context.Background(), "sales", "users")
	if err != nil {
		t.Fatalf("GetTableSchema: %v", err)
	}
	if len(got.Fields) != 3 {
		t.Fatalf("Fields: want 3, got %d", len(got.Fields))
	}
	if len(got.PrimaryKeys) != 1 || got.PrimaryKeys[0] != "user_id" {
		t.Errorf("PrimaryKeys: want [user_id], got %v", got.PrimaryKeys)
	}
}

func TestPaimonGetTableConfig(t *testing.T) {
	wh := buildPaimonTable(t, "sales", "users", samplePaimonSchema(), nil)
	c, _ := NewPaimonClient(wh)
	got, err := c.GetTableConfig(context.Background(), "sales", "users")
	if err != nil {
		t.Fatalf("GetTableConfig: %v", err)
	}
	if got.BucketCount != 4 {
		t.Errorf("BucketCount: want 4, got %d", got.BucketCount)
	}
	if got.ChangelogMode != "input" {
		t.Errorf("ChangelogMode: want input, got %q", got.ChangelogMode)
	}
	if got.MergeEngine != "deduplicate" {
		t.Errorf("MergeEngine: want deduplicate, got %q", got.MergeEngine)
	}
}

func TestPaimonListSnapshots(t *testing.T) {
	snaps := []map[string]any{
		{"version": 3, "id": 1, "schemaId": 0, "commitUser": "u1", "commitKind": "APPEND", "timeMillis": 1700000001000, "totalRecordCount": 10, "deltaRecordCount": 10},
		{"version": 3, "id": 2, "schemaId": 0, "commitUser": "u1", "commitKind": "OVERWRITE", "timeMillis": 1700000002000, "totalRecordCount": 12, "deltaRecordCount": 2},
	}
	wh := buildPaimonTable(t, "sales", "users", samplePaimonSchema(), snaps)
	c, _ := NewPaimonClient(wh)
	got, err := c.ListSnapshots(context.Background(), "sales", "users")
	if err != nil {
		t.Fatalf("ListSnapshots: %v", err)
	}
	if len(got) != 2 {
		t.Fatalf("Snapshots: want 2, got %d", len(got))
	}
	if got[0].SnapshotID != 1 || got[1].SnapshotID != 2 {
		t.Errorf("snapshot order: want [1,2], got [%d,%d]", got[0].SnapshotID, got[1].SnapshotID)
	}
	if got[0].Operation != "APPEND" {
		t.Errorf("Operation: want APPEND, got %q", got[0].Operation)
	}
}

func TestPaimonListSnapshotsEmpty(t *testing.T) {
	wh := buildPaimonTable(t, "sales", "users", samplePaimonSchema(), nil)
	c, _ := NewPaimonClient(wh)
	got, err := c.ListSnapshots(context.Background(), "sales", "users")
	if err != nil {
		t.Fatalf("ListSnapshots empty: %v", err)
	}
	if len(got) != 0 {
		t.Errorf("expected zero snapshots, got %d", len(got))
	}
}

func TestPaimonRejectsBadWarehouse(t *testing.T) {
	if _, err := NewPaimonClient(""); err == nil {
		t.Error("expected error for empty warehouse")
	}
	if _, err := NewPaimonClient("/nonexistent/path/abc/def"); err == nil {
		t.Error("expected error for missing warehouse")
	}
}

func TestPaimonCheckWarehouseReadable(t *testing.T) {
	wh := t.TempDir()
	c, _ := NewPaimonClient(wh)
	if err := c.CheckWarehouseReadable(); err != nil {
		t.Errorf("CheckWarehouseReadable: %v", err)
	}
}
