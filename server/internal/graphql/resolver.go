// Package graphql provides GraphQL resolvers for the reactor-server API.
package graphql

import (
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sandboxws/flink-reactor-console/server/internal/alerts"
	"github.com/sandboxws/flink-reactor-console/server/internal/catalogs"
	"github.com/sandboxws/flink-reactor-console/server/internal/cluster"
	"github.com/sandboxws/flink-reactor-console/server/internal/config"
	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
	"github.com/sandboxws/flink-reactor-console/server/internal/savepoints"
	"github.com/sandboxws/flink-reactor-console/server/internal/simulation"
	"github.com/sandboxws/flink-reactor-console/server/internal/store"
	"github.com/sandboxws/flink-reactor-console/server/internal/tap"
)

//go:generate go run github.com/99designs/gqlgen generate

// Resolver is the root resolver for dependency injection.
type Resolver struct {
	Manager            *cluster.Manager
	InstrumentRegistry *instruments.Registry
	TapStore           *tap.Store
	CatalogService     *catalogs.Service
	CatalogInitDDL     []string      // DDL statements to replay into new SQL sessions
	Stores             *store.Stores // nil when storage disabled
	StoragePool        *pgxpool.Pool
	StorageConfig      config.StorageConfig
	SimulationEngine   *simulation.Engine // nil when storage disabled
	SavepointTriggers  *savepoints.TriggerTypeCache
	AlertEngine        *alerts.Engine // nil when storage disabled
}
