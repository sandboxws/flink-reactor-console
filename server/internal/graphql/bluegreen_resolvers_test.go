package graphql_test

import (
	"context"
	"strings"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/graphql"
)

// TestBlueGreenDeploymentConfigDiff_NilManager exercises the "cluster manager
// not configured" branch — the most basic error contract.
func TestBlueGreenDeploymentConfigDiff_NilManager(t *testing.T) {
	t.Parallel()
	resolver := &graphql.Resolver{}

	_, err := queryResolver(resolver).BlueGreenDeploymentConfigDiff(
		context.Background(), "any-name", nil, nil,
	)
	if err == nil {
		t.Fatal("expected error when Manager is nil")
	}
	if !strings.Contains(err.Error(), "cluster manager not configured") {
		t.Errorf("expected 'cluster manager not configured' error, got: %v", err)
	}
}

// TestBlueGreenDeploymentConfigDiff_NoK8s exercises the path where a cluster
// is configured but K8s is not — e.g. a Flink-only setup with no operator.
// Without K8s the diff is unreachable and must surface a clear error.
func TestBlueGreenDeploymentConfigDiff_NoK8s(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	_, err := queryResolver(resolver).BlueGreenDeploymentConfigDiff(
		context.Background(), "missing", nil, nil,
	)
	if err == nil {
		t.Fatal("expected error when K8sService is not configured")
	}
	if !strings.Contains(err.Error(), "kubernetes not configured") {
		t.Errorf("expected 'kubernetes not configured' error, got: %v", err)
	}
}
