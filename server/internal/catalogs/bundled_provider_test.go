package catalogs

import (
	"context"
	"testing"
)

func TestBundledProvider_ListCatalogs(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}

	catalogs, err := p.ListCatalogs(context.Background())
	if err != nil {
		t.Fatalf("ListCatalogs() error: %v", err)
	}

	// 4 JDBC + 9 Kafka domain catalogs = 13 total
	expected := []string{
		"pagila", "chinook", "employees", "flink_sink",
		"ecom", "banking", "iot", "rides", "grocery", "analytics", "cdc", "lake", "orders",
	}
	if len(catalogs) != len(expected) {
		t.Fatalf("got %d catalogs, want %d", len(catalogs), len(expected))
	}
	for i, name := range expected {
		if catalogs[i].Name != name {
			t.Errorf("catalog[%d].Name = %q, want %q", i, catalogs[i].Name, name)
		}
		if catalogs[i].Source != "bundled" {
			t.Errorf("catalog[%d].Source = %q, want %q", i, catalogs[i].Source, "bundled")
		}
	}
}

func TestBundledProvider_ListDatabases(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}

	tests := []struct {
		catalog  string
		expected []string
	}{
		{"pagila", []string{"public"}},
		{"chinook", []string{"public"}},
		{"employees", []string{"employees"}},
		{"flink_sink", []string{"public"}},
		{"ecom", []string{"default"}},
		{"banking", []string{"default"}},
		{"iot", []string{"default"}},
		{"rides", []string{"default"}},
		{"grocery", []string{"default"}},
		{"analytics", []string{"default"}},
		{"cdc", []string{"default"}},
		{"lake", []string{"default"}},
		{"orders", []string{"default"}},
		{"nonexistent", nil},
	}

	for _, tt := range tests {
		dbs, err := p.ListDatabases(context.Background(), tt.catalog)
		if err != nil {
			t.Errorf("ListDatabases(%q) error: %v", tt.catalog, err)
			continue
		}
		if len(dbs) != len(tt.expected) {
			t.Errorf("ListDatabases(%q) got %d, want %d", tt.catalog, len(dbs), len(tt.expected))
			continue
		}
		for i, name := range tt.expected {
			if dbs[i].Name != name {
				t.Errorf("ListDatabases(%q)[%d] = %q, want %q", tt.catalog, i, dbs[i].Name, name)
			}
		}
	}
}

func TestBundledProvider_ListTables(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}

	tests := []struct {
		catalog  string
		database string
		count    int
	}{
		{"pagila", "public", 15},
		{"chinook", "public", 11},
		{"employees", "employees", 6},
		{"flink_sink", "public", 0},
		{"ecom", "default", 4},
		{"banking", "default", 2},
		{"iot", "default", 2},
		{"rides", "default", 3},
		{"grocery", "default", 3},
		{"analytics", "default", 1},
		{"cdc", "default", 1},
		{"lake", "default", 3},
		{"orders", "default", 1},
	}

	for _, tt := range tests {
		tables, err := p.ListTables(context.Background(), tt.catalog, tt.database)
		if err != nil {
			t.Fatalf("ListTables(%q, %q) error: %v", tt.catalog, tt.database, err)
		}
		if len(tables) != tt.count {
			t.Errorf("ListTables(%q, %q) = %d tables, want %d", tt.catalog, tt.database, len(tables), tt.count)
		}
	}

	// Nonexistent returns nil
	tables, err := p.ListTables(context.Background(), "nonexistent", "public")
	if err != nil {
		t.Fatalf("ListTables(nonexistent) error: %v", err)
	}
	if tables != nil {
		t.Errorf("expected nil for nonexistent catalog, got %d tables", len(tables))
	}
}

func TestBundledProvider_ListColumns(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}

	// Verify pagila actor columns
	cols, err := p.ListColumns(context.Background(), "pagila", "public", "actor")
	if err != nil {
		t.Fatalf("ListColumns(actor) error: %v", err)
	}
	expectedCols := []ColumnInfo{
		{Name: "actor_id", Type: "INT"},
		{Name: "first_name", Type: "STRING"},
		{Name: "last_name", Type: "STRING"},
		{Name: "last_update", Type: "TIMESTAMP(3)"},
	}
	if len(cols) != len(expectedCols) {
		t.Fatalf("actor got %d columns, want %d", len(cols), len(expectedCols))
	}
	for i, exp := range expectedCols {
		if cols[i] != exp {
			t.Errorf("column[%d] = %+v, want %+v", i, cols[i], exp)
		}
	}

	// Verify chinook artist columns
	cols, err = p.ListColumns(context.Background(), "chinook", "public", "artist")
	if err != nil {
		t.Fatalf("ListColumns(artist) error: %v", err)
	}
	if len(cols) != 2 {
		t.Fatalf("artist got %d columns, want 2", len(cols))
	}
	if cols[0].Name != "artist_id" || cols[0].Type != "INT" {
		t.Errorf("first column = %+v, want {artist_id INT}", cols[0])
	}

	// Verify employees employee columns
	cols, err = p.ListColumns(context.Background(), "employees", "employees", "employee")
	if err != nil {
		t.Fatalf("ListColumns(employee) error: %v", err)
	}
	if len(cols) != 6 {
		t.Fatalf("employee got %d columns, want 6", len(cols))
	}
	if cols[0].Name != "id" || cols[0].Type != "BIGINT" {
		t.Errorf("first column = %+v, want {id BIGINT}", cols[0])
	}

	// Verify ecom orders columns (Kafka domain catalog)
	cols, err = p.ListColumns(context.Background(), "ecom", "default", "orders")
	if err != nil {
		t.Fatalf("ListColumns(ecom orders) error: %v", err)
	}
	if len(cols) != 6 {
		t.Fatalf("ecom orders got %d columns, want 6", len(cols))
	}
	if cols[0].Name != "orderId" || cols[0].Type != "STRING" {
		t.Errorf("ecom orders first column = %+v, want {orderId STRING}", cols[0])
	}

	// Verify banking transactions columns
	cols, err = p.ListColumns(context.Background(), "banking", "default", "transactions")
	if err != nil {
		t.Fatalf("ListColumns(banking transactions) error: %v", err)
	}
	if len(cols) != 7 {
		t.Fatalf("banking transactions got %d columns, want 7", len(cols))
	}
	if cols[0].Name != "txnId" || cols[0].Type != "STRING" {
		t.Errorf("banking transactions first column = %+v, want {txnId STRING}", cols[0])
	}

	// Nonexistent table returns nil
	cols, err = p.ListColumns(context.Background(), "pagila", "public", "nonexistent")
	if err != nil {
		t.Fatalf("ListColumns(nonexistent) error: %v", err)
	}
	if cols != nil {
		t.Errorf("expected nil for nonexistent table, got %d columns", len(cols))
	}
}
