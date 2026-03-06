// Package graphql provides GraphQL resolvers for the reactor-server API.
package graphql

import "github.com/sandboxws/flink-reactor/apps/server/internal/flink"

//go:generate go run github.com/99designs/gqlgen generate

// Resolver is the root resolver for dependency injection.
type Resolver struct {
	Service   *flink.Service
	Poller    *flink.Poller
	SQLClient *flink.Client // Client configured for SQL Gateway base URL.
}
