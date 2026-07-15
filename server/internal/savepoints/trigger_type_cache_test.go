package savepoints_test

import (
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/savepoints"
)

func TestTriggerTypeCache_LookupMissingDefaultsToManual(t *testing.T) {
	t.Parallel()
	c := savepoints.NewTriggerTypeCache()
	if got := c.Lookup("default", "job-1", "sp-1"); got != savepoints.TriggerManual {
		t.Errorf("expected TriggerManual for unknown key, got %q", got)
	}
}

func TestTriggerTypeCache_RecordAndLookup(t *testing.T) {
	t.Parallel()
	c := savepoints.NewTriggerTypeCache()
	c.Record("default", "job-1", "sp-1", savepoints.TriggerStopWithSavepoint)
	if got := c.Lookup("default", "job-1", "sp-1"); got != savepoints.TriggerStopWithSavepoint {
		t.Errorf("expected TriggerStopWithSavepoint, got %q", got)
	}
}

func TestTriggerTypeCache_ConvenienceRecorders(t *testing.T) {
	t.Parallel()
	c := savepoints.NewTriggerTypeCache()

	c.RecordManual("c", "j", "m")
	c.RecordStopWithSavepoint("c", "j", "s")
	c.RecordBlueGreen("c", "j", "b")

	cases := map[string]savepoints.TriggerType{
		"m": savepoints.TriggerManual,
		"s": savepoints.TriggerStopWithSavepoint,
		"b": savepoints.TriggerBlueGreen,
	}
	for id, want := range cases {
		if got := c.Lookup("c", "j", id); got != want {
			t.Errorf("savepoint %s: expected %q, got %q", id, want, got)
		}
	}
}

func TestTriggerTypeCache_RecordOverwrites(t *testing.T) {
	t.Parallel()
	c := savepoints.NewTriggerTypeCache()
	c.RecordManual("c", "j", "sp")
	c.RecordBlueGreen("c", "j", "sp")
	if got := c.Lookup("c", "j", "sp"); got != savepoints.TriggerBlueGreen {
		t.Errorf("expected last-write-wins TriggerBlueGreen, got %q", got)
	}
}

// Lookups for different (cluster, jobID, savepointID) tuples must not collide.
func TestTriggerTypeCache_KeyIsolation(t *testing.T) {
	t.Parallel()
	c := savepoints.NewTriggerTypeCache()
	c.RecordManual("clusterA", "job-1", "sp-1")
	c.RecordStopWithSavepoint("clusterB", "job-1", "sp-1")

	if got := c.Lookup("clusterA", "job-1", "sp-1"); got != savepoints.TriggerManual {
		t.Errorf("clusterA lookup expected MANUAL, got %q", got)
	}
	if got := c.Lookup("clusterB", "job-1", "sp-1"); got != savepoints.TriggerStopWithSavepoint {
		t.Errorf("clusterB lookup expected STOP_WITH_SAVEPOINT, got %q", got)
	}
	// Different jobID, same savepointID should also miss.
	if got := c.Lookup("clusterA", "job-2", "sp-1"); got != savepoints.TriggerManual {
		t.Errorf("job-2 (uncached) expected MANUAL default, got %q", got)
	}
}
