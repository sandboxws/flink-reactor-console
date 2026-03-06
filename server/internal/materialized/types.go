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
}
