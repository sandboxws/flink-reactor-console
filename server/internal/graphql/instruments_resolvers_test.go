package graphql_test

import (
	"context"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/graphql"
)

// A transient connection test builds the instrument via the factory, so the
// resolver needs no registry. Unknown types and invalid configs both surface as
// a structured failure result (ok=false + message), not a GraphQL error.

func TestTestInstrumentConnectionUnknownType(t *testing.T) {
	r := &graphql.Resolver{}
	res, err := r.Mutation().TestInstrumentConnection(
		context.Background(), "bogus", "x", map[string]any{},
	)
	if err != nil {
		t.Fatalf("unexpected resolver error: %v", err)
	}
	if res.Ok {
		t.Fatal("expected ok=false for an unknown instrument type")
	}
	if res.Message == nil || *res.Message == "" {
		t.Fatal("expected a non-empty failure message")
	}
}

func TestTestInstrumentConnectionInvalidConfig(t *testing.T) {
	r := &graphql.Resolver{}
	// Kafka with no brokers fails Init validation immediately, without dialing.
	res, err := r.Mutation().TestInstrumentConnection(
		context.Background(), "kafka", "local", map[string]any{},
	)
	if err != nil {
		t.Fatalf("unexpected resolver error: %v", err)
	}
	if res.Ok {
		t.Fatal("expected ok=false when required config is missing")
	}
	if res.Message == nil {
		t.Fatal("expected a failure message")
	}
}
