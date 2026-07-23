package graphql_test

import (
	"context"
	"testing"
)

func TestJobManagerThreadDump_MapsThreadInfos(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	dump, err := queryResolver(resolver).JobManagerThreadDump(context.Background(), nil)
	if err != nil {
		t.Fatalf("JobManagerThreadDump() returned error: %v", err)
	}

	// MockThreadDump returns 2 threads.
	if len(dump) != 2 {
		t.Fatalf("expected 2 thread entries, got %d", len(dump))
	}
	if dump[0].ThreadName != "main" {
		t.Errorf("expected first thread name %q, got %q", "main", dump[0].ThreadName)
	}
	if dump[0].StringifiedThreadInfo == "" {
		t.Error("expected non-empty stringifiedThreadInfo for first thread")
	}
}

func TestJobManagerThreadDump_404FromFlink_ReturnsEmptyNoError(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolverWith404(t)
	defer cleanup()

	dump, err := queryResolver(resolver).JobManagerThreadDump(context.Background(), nil)
	if err != nil {
		t.Fatalf("expected nil error on 404, got: %v", err)
	}
	if len(dump) != 0 {
		t.Errorf("expected empty thread dump, got %d entries", len(dump))
	}
}
