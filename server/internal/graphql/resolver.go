// Package graphql provides GraphQL resolvers for the reactor-server API.
package graphql

import (
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments"
	"github.com/sandboxws/flink-reactor/apps/server/internal/tap"
)

//go:generate go run github.com/99designs/gqlgen generate

// Resolver is the root resolver for dependency injection.
type Resolver struct {
	Manager            *cluster.Manager
	InstrumentRegistry *instruments.Registry
	TapLoader          *tap.Loader
}
