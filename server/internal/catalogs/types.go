// Package catalogs provides catalog browsing via pluggable providers.
package catalogs

import "context"

// CatalogInfo represents a registered Flink catalog.
type CatalogInfo struct {
	Name   string
	Source string // "bundled" or "live"
}

// CatalogDatabase represents a database within a catalog.
type CatalogDatabase struct {
	Name string
}

// CatalogTable represents a table within a catalog database.
type CatalogTable struct {
	Name string
}

// ColumnInfo represents a column within a catalog table.
type ColumnInfo struct {
	Name string
	Type string // Flink SQL type (e.g., "STRING", "INT", "TIMESTAMP(3)")
}

// CatalogProvider abstracts a source of catalog metadata.
// Implementations include SQLGatewayProvider (live Flink) and BundledProvider (embedded examples).
type CatalogProvider interface {
	ListCatalogs(ctx context.Context) ([]CatalogInfo, error)
	ListDatabases(ctx context.Context, catalog string) ([]CatalogDatabase, error)
	ListTables(ctx context.Context, catalog, database string) ([]CatalogTable, error)
	ListColumns(ctx context.Context, catalog, database, table string) ([]ColumnInfo, error)
}
