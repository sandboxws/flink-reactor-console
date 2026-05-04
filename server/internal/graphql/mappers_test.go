package graphql

import (
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

func TestMapJobConfig_Nil(t *testing.T) {
	t.Parallel()

	if got := mapJobConfig(nil); got != nil {
		t.Errorf("expected nil, got %+v", got)
	}
}

func TestMapJobConfig_EmptyUserConfig(t *testing.T) {
	t.Parallel()

	jc := &flink.JobConfig{
		JID:  "abc",
		Name: "demo",
	}
	jc.ExecutionConfig.ExecutionMode = "PIPELINED"
	jc.ExecutionConfig.RestartStrategy = "fixed-delay"
	jc.ExecutionConfig.JobParallelism = 2
	jc.ExecutionConfig.ObjectReuseMode = false
	jc.ExecutionConfig.UserConfig = map[string]string{}

	got := mapJobConfig(jc)
	if got == nil {
		t.Fatal("expected non-nil")
	}
	if got.Jid != "abc" || got.Name != "demo" {
		t.Errorf("metadata mismatch: got %+v", got)
	}
	if len(got.UserConfig) != 0 {
		t.Errorf("expected empty UserConfig slice, got %d entries", len(got.UserConfig))
	}
	if got.UserConfig == nil {
		t.Error("expected non-nil empty slice for UserConfig")
	}
}

func TestMapJobConfig_SortedKeys(t *testing.T) {
	t.Parallel()

	jc := &flink.JobConfig{}
	jc.ExecutionConfig.UserConfig = map[string]string{
		"pipeline.name":          "demo",
		"flinkreactor.sql":       "SELECT 1",
		"pipeline.sql":           "INSERT INTO sink SELECT * FROM src",
		"execution.savepoint":    "/tmp/sp",
		"state.backend.rocksdb":  "true",
	}

	got := mapJobConfig(jc)
	wantOrder := []string{
		"execution.savepoint",
		"flinkreactor.sql",
		"pipeline.name",
		"pipeline.sql",
		"state.backend.rocksdb",
	}
	if len(got.UserConfig) != len(wantOrder) {
		t.Fatalf("expected %d entries, got %d", len(wantOrder), len(got.UserConfig))
	}
	for i, want := range wantOrder {
		if got.UserConfig[i].Key != want {
			t.Errorf("entry %d: expected key %q, got %q", i, want, got.UserConfig[i].Key)
		}
	}
}

func TestMapJobConfig_PipelineSqlRoundTrips(t *testing.T) {
	t.Parallel()

	wantSQL := "INSERT INTO orders_sink\nSELECT id, total\nFROM orders_src\nWHERE region = 'EU'"

	jc := &flink.JobConfig{}
	jc.ExecutionConfig.UserConfig = map[string]string{
		"pipeline.sql": wantSQL,
	}

	got := mapJobConfig(jc)
	if got == nil {
		t.Fatal("expected non-nil")
	}

	var found string
	for _, e := range got.UserConfig {
		if e.Key == "pipeline.sql" {
			found = e.Value
			break
		}
	}
	if found != wantSQL {
		t.Errorf("pipeline.sql round-trip mismatch:\nwant: %q\ngot:  %q", wantSQL, found)
	}
}
