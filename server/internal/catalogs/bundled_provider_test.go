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

	expected := []string{"pagila", "chinook", "employees"}
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

	// Pagila has 15 tables
	tables, err := p.ListTables(context.Background(), "pagila", "public")
	if err != nil {
		t.Fatalf("ListTables(pagila) error: %v", err)
	}
	if len(tables) != 15 {
		t.Errorf("pagila table count = %d, want 15", len(tables))
	}

	// Chinook has 11 tables
	tables, err = p.ListTables(context.Background(), "chinook", "public")
	if err != nil {
		t.Fatalf("ListTables(chinook) error: %v", err)
	}
	if len(tables) != 11 {
		t.Errorf("chinook table count = %d, want 11", len(tables))
	}

	// Employees has 6 tables (in 'employees' schema)
	tables, err = p.ListTables(context.Background(), "employees", "employees")
	if err != nil {
		t.Fatalf("ListTables(employees) error: %v", err)
	}
	if len(tables) != 6 {
		t.Errorf("employees table count = %d, want 6", len(tables))
	}

	// Nonexistent returns nil
	tables, err = p.ListTables(context.Background(), "nonexistent", "public")
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

	// Nonexistent table returns nil
	cols, err = p.ListColumns(context.Background(), "pagila", "public", "nonexistent")
	if err != nil {
		t.Fatalf("ListColumns(nonexistent) error: %v", err)
	}
	if cols != nil {
		t.Errorf("expected nil for nonexistent table, got %d columns", len(cols))
	}
}
