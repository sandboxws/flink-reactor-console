package catalogs

import (
	"strings"
	"testing"
)

func TestGenerateSQL_CatalogCount(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}
	init := NewInitializer(p.Data(), nil, nil)
	stmts := init.GenerateSQL()

	if len(stmts) == 0 {
		t.Fatal("expected non-empty SQL statements")
	}

	var catalogCount int
	for _, s := range stmts {
		if strings.HasPrefix(s, "CREATE CATALOG") {
			catalogCount++
		}
	}
	if catalogCount != 13 {
		t.Errorf("got %d CREATE CATALOG statements, want 13", catalogCount)
	}
}

func TestGenerateSQL_JDBCTable(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}
	init := NewInitializer(p.Data(), nil, nil)
	stmts := init.GenerateSQL()

	// Find the pagila actor CREATE TABLE statement
	var found string
	for _, s := range stmts {
		if strings.Contains(s, "`pagila`.`public`.`actor`") {
			found = s
			break
		}
	}
	if found == "" {
		t.Fatal("CREATE TABLE for pagila actor not found")
	}

	checks := []string{
		"'connector' = 'jdbc'",
		"'table-name' = 'actor'",
		"'url' = 'jdbc:postgresql://postgres:5432/pagila'",
		"'username' = 'reactor'",
		"`actor_id` INT",
		"`first_name` STRING",
	}
	for _, check := range checks {
		if !strings.Contains(found, check) {
			t.Errorf("pagila actor SQL missing %q\nGot:\n%s", check, found)
		}
	}
}

func TestGenerateSQL_ChinookTables(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}
	init := NewInitializer(p.Data(), nil, nil)
	stmts := init.GenerateSQL()

	// Count CREATE TABLE statements for chinook
	var tableCount int
	for _, s := range stmts {
		if strings.Contains(s, "`chinook`.`public`.") && strings.HasPrefix(s, "CREATE TABLE") {
			tableCount++
		}
	}
	if tableCount != 11 {
		t.Errorf("got %d chinook CREATE TABLE statements, want 11", tableCount)
	}

	// Verify track table has JDBC properties
	var trackSQL string
	for _, s := range stmts {
		if strings.Contains(s, "`chinook`.`public`.`track`") {
			trackSQL = s
			break
		}
	}
	if trackSQL == "" {
		t.Fatal("CREATE TABLE for track not found")
	}
	if !strings.Contains(trackSQL, "'url' = 'jdbc:postgresql://postgres:5432/chinook'") {
		t.Errorf("track SQL missing chinook JDBC URL")
	}
}

func TestGenerateSQL_EmployeesTables(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}
	init := NewInitializer(p.Data(), nil, nil)
	stmts := init.GenerateSQL()

	// Count CREATE TABLE statements for employees
	var tableCount int
	for _, s := range stmts {
		if strings.Contains(s, "`employees`.`employees`.") && strings.HasPrefix(s, "CREATE TABLE") {
			tableCount++
		}
	}
	if tableCount != 6 {
		t.Errorf("got %d employees CREATE TABLE statements, want 6", tableCount)
	}

	// Verify salary table has correct URL
	var salarySQL string
	for _, s := range stmts {
		if strings.Contains(s, "`employees`.`employees`.`salary`") {
			salarySQL = s
			break
		}
	}
	if salarySQL == "" {
		t.Fatal("CREATE TABLE for salary not found")
	}
	if !strings.Contains(salarySQL, "'url' = 'jdbc:postgresql://postgres:5432/employees'") {
		t.Errorf("salary SQL missing employees JDBC URL")
	}
}

func TestGenerateSQL_StatementOrder(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}
	init := NewInitializer(p.Data(), nil, nil)
	stmts := init.GenerateSQL()

	// First statement should be CREATE CATALOG for pagila
	if !strings.Contains(stmts[0], "pagila") || !strings.HasPrefix(stmts[0], "CREATE CATALOG") {
		t.Errorf("first statement should be CREATE CATALOG pagila, got: %s", stmts[0])
	}

	if !strings.HasPrefix(stmts[1], "CREATE DATABASE") {
		t.Errorf("second statement should be CREATE DATABASE, got: %s", stmts[1])
	}

	if !strings.HasPrefix(stmts[2], "CREATE TABLE") {
		t.Errorf("third statement should be CREATE TABLE, got: %s", stmts[2])
	}
}

func TestGenerateSQL_CreateDatabaseIfNotExists(t *testing.T) {
	p, err := NewBundledProvider()
	if err != nil {
		t.Fatalf("NewBundledProvider() error: %v", err)
	}
	init := NewInitializer(p.Data(), nil, nil)
	stmts := init.GenerateSQL()

	for _, s := range stmts {
		if strings.HasPrefix(s, "CREATE DATABASE") {
			if !strings.Contains(s, "IF NOT EXISTS") {
				t.Errorf("CREATE DATABASE missing IF NOT EXISTS: %s", s)
			}
		}
	}
}

func TestTruncate(t *testing.T) {
	short := "hello"
	if got := truncate(short, 10); got != "hello" {
		t.Errorf("truncate(%q, 10) = %q, want %q", short, got, "hello")
	}

	long := strings.Repeat("x", 200)
	got := truncate(long, 50)
	if len(got) != 50 {
		t.Errorf("truncate(200 chars, 50) length = %d, want 50", len(got))
	}
	if !strings.HasSuffix(got, "...") {
		t.Error("truncated string should end with ...")
	}
}
