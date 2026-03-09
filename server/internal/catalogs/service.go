// Package catalogs provides catalog browsing via pluggable providers.
package catalogs

import (
	"context"
	"log/slog"
)

// Service composes multiple CatalogProviders and merges their results.
type Service struct {
	providers []CatalogProvider
	logger    *slog.Logger
}

// NewService creates a catalog service that queries all registered providers.
func NewService(logger *slog.Logger, providers ...CatalogProvider) *Service {
	return &Service{
		providers: providers,
		logger:    logger,
	}
}

// ListCatalogs returns catalogs from all registered providers.
func (s *Service) ListCatalogs(ctx context.Context) ([]CatalogInfo, error) {
	var all []CatalogInfo
	for _, p := range s.providers {
		items, err := p.ListCatalogs(ctx)
		if err != nil {
			s.logger.Warn("catalog provider error", "op", "ListCatalogs", "error", err)
			continue
		}
		all = append(all, items...)
	}
	return all, nil
}

// ListDatabases returns databases for the given catalog from the first matching provider.
func (s *Service) ListDatabases(ctx context.Context, catalog string) ([]CatalogDatabase, error) {
	var all []CatalogDatabase
	for _, p := range s.providers {
		items, err := p.ListDatabases(ctx, catalog)
		if err != nil {
			s.logger.Warn("catalog provider error", "op", "ListDatabases", "catalog", catalog, "error", err)
			continue
		}
		all = append(all, items...)
	}
	return all, nil
}

// ListTables returns tables for the given catalog and database from all providers.
func (s *Service) ListTables(ctx context.Context, catalog, database string) ([]CatalogTable, error) {
	var all []CatalogTable
	for _, p := range s.providers {
		items, err := p.ListTables(ctx, catalog, database)
		if err != nil {
			s.logger.Warn("catalog provider error", "op", "ListTables", "catalog", catalog, "database", database, "error", err)
			continue
		}
		all = append(all, items...)
	}
	return all, nil
}

// ListColumns returns columns for the given table from all providers.
func (s *Service) ListColumns(ctx context.Context, catalog, database, table string) ([]ColumnInfo, error) {
	var all []ColumnInfo
	for _, p := range s.providers {
		items, err := p.ListColumns(ctx, catalog, database, table)
		if err != nil {
			s.logger.Warn("catalog provider error", "op", "ListColumns", "catalog", catalog, "database", database, "table", table, "error", err)
			continue
		}
		all = append(all, items...)
	}
	return all, nil
}
