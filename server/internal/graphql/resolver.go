// Package graphql provides GraphQL resolvers for the reactor-server API.
package graphql

import "github.com/sandboxws/flink-reactor/apps/server/internal/cluster"

//go:generate go run github.com/99designs/gqlgen generate

// Resolver is the root resolver for dependency injection.
type Resolver struct {
	Manager *cluster.Manager
}
