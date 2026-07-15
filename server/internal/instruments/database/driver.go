package database

import (
	"context"
	"time"
)

// Schema represents a database schema.
type Schema struct {
	Name       string
	TableCount int
}

// TableSummary is a summary of a table within a schema.
type TableSummary struct {
	Name             string
	Schema           string
	Type             string // "TABLE" or "VIEW"
	RowCountEstimate int64
}

// TableDetail is detailed information about a table.
type TableDetail struct {
	Name        string
	Schema      string
	Columns     []Column
	Indexes     []Index
	Constraints []Constraint
	DDL         string
}

// Column describes a single column in a table.
type Column struct {
	Name         string
	DataType     string
	Nullable     bool
	DefaultValue string
	IsPrimaryKey bool
	Comment      string
}

// Index describes a table index.
type Index struct {
	Name    string
	Columns []string
	Unique  bool
	Type    string // e.g. "btree", "hash"
}

// Constraint describes a table constraint.
type Constraint struct {
	Name       string
	Type       string // "PRIMARY KEY", "FOREIGN KEY", "UNIQUE", "CHECK"
	Columns    []string
	RefTable   string
	RefColumns []string
}

// QueryResult holds the result of an executed query.
type QueryResult struct {
	Columns         []ResultColumn
	Rows            [][]any
	RowCount        int
	ExecutionTimeMs int64
	Truncated       bool
}

// ResultColumn describes a column in a query result set.
type ResultColumn struct {
	Name     string
	DataType string
}

// Driver abstracts database-specific operations for different SQL dialects.
type Driver interface {
	Connect(ctx context.Context, dsn string) error
	Close() error
	Ping(ctx context.Context) error
	ListSchemas(ctx context.Context) ([]Schema, error)
	ListTables(ctx context.Context, schema string) ([]TableSummary, error)
	GetTableDetail(ctx context.Context, schema, table string) (*TableDetail, error)
	ExecuteQuery(ctx context.Context, sql string, timeout time.Duration, maxRows int) (*QueryResult, error)
}
