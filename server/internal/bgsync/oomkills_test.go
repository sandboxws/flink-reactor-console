package bgsync

import (
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/k8s"
)

func TestCountNewOOMKills(t *testing.T) {
	seen := map[string]int{}

	first := []k8s.OOMKill{
		{Pod: "tm-0", Container: "flink", RestartCount: 1},
		{Pod: "tm-1", Container: "flink", RestartCount: 3},
	}
	// Seeding pass only populates the baseline.
	if n := countNewOOMKills(seen, first, true); n != 0 {
		t.Fatalf("seeding pass should count 0, got %d", n)
	}
	// Same terminated state on the next poll must not be recounted.
	if n := countNewOOMKills(seen, first, false); n != 0 {
		t.Fatalf("unchanged state should count 0, got %d", n)
	}
	// tm-1 OOMs again (restart advances) and a fresh tm-2 appears → 2 new.
	next := []k8s.OOMKill{
		{Pod: "tm-0", Container: "flink", RestartCount: 1}, // unchanged
		{Pod: "tm-1", Container: "flink", RestartCount: 4}, // advanced
		{Pod: "tm-2", Container: "flink", RestartCount: 1}, // new pod
	}
	if n := countNewOOMKills(seen, next, false); n != 2 {
		t.Fatalf("expected 2 new OOM kills, got %d", n)
	}
}
