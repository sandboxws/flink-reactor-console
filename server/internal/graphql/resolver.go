// Package graphql provides GraphQL resolvers for the reactor-server API.
package graphql

import (
	"github.com/jackc/pgx/v5/pgxpool"
	instruments "github.com/sandboxws/flink-reactor-instruments"
	"github.com/sandboxws/flink-reactor/apps/server/internal/catalogs"
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/config"
	"github.com/sandboxws/flink-reactor/apps/server/internal/tap"
)

//go:generate go run github.com/99designs/gqlgen generate

// Resolver is the root resolver for dependency injection.
type Resolver struct {
	Manager            *cluster.Manager
	InstrumentRegistry *instruments.Registry
	TapLoader          *tap.Loader
	CatalogService     *catalogs.Service
	CatalogInitDDL     []string // DDL statements to replay into new SQL sessions
	StoragePool        *pgxpool.Pool
	StorageConfig      config.StorageConfig
}
