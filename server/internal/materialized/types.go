// Package materialized provides domain types and operations for Flink
// materialized tables, accessed via the SQL Gateway REST API.
package materialized

// RefreshStatus represents the refresh state of a materialized table.
type RefreshStatus string

// Materialized table refresh status constants.
const (
	RefreshStatusActivated    RefreshStatus = "ACTIVATED"
	RefreshStatusSuspended    RefreshStatus = "SUSPENDED"
	RefreshStatusInitializing RefreshStatus = "INITIALIZING"
)

// Table represents a Flink materialized table and its metadata.
type Table struct {
	Name          string
	Catalog       string
	Database      string
	RefreshStatus RefreshStatus
	RefreshMode   string
	Freshness     string
	DefiningQuery string
	// Columns is the table's schema, parsed from the DESCRIBE MATERIALIZED
	// TABLE result (Flink 2.3+ exposes explicit columns/PK/watermark).
	Columns []Column
}

// Column is one column in a materialized table's schema. It is parsed from a
// DESCRIBE MATERIALIZED TABLE result row, whose fields are:
// name, type, null, key, extras, watermark.
type Column struct {
	Name       string
	Type       string
	Nullable   bool
	PrimaryKey bool
	// Watermark holds the watermark expression when the column is a rowtime
	// attribute (the DESCRIBE "watermark" field), otherwise empty.
	Watermark string
}
