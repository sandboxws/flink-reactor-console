package graphql

import (
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

func TestMapRestartInfo_FullMetrics(t *testing.T) {
	t.Parallel()

	jc := &flink.JobConfig{}
	jc.ExecutionConfig.RestartStrategy = "fixed-delay (3 restarts)"
	metrics := []flink.MetricItem{
		{ID: "numRestarts", Value: "3"},
		{ID: "fullRestarts", Value: "1"},
		{ID: "uptime", Value: "3600000"},
		{ID: "downtime", Value: "0"},
	}

	ri := mapRestartInfo(jc, metrics)
	if ri == nil {
		t.Fatal("expected non-nil RestartInfo")
	}
	if ri.NumRestarts == nil || *ri.NumRestarts != 3 {
		t.Errorf("numRestarts = %v, want 3", ri.NumRestarts)
	}
	if ri.FullRestarts == nil || *ri.FullRestarts != 1 {
		t.Errorf("fullRestarts = %v, want 1", ri.FullRestarts)
	}
	if ri.RestartStrategy == nil || *ri.RestartStrategy != "fixed-delay (3 restarts)" {
		t.Errorf("restartStrategy = %v", ri.RestartStrategy)
	}
	if ri.UptimeMs == nil || *ri.UptimeMs != "3600000" {
		t.Errorf("uptimeMs = %v, want 3600000", ri.UptimeMs)
	}
}

func TestMapRestartInfo_AbsentMetricIsNil(t *testing.T) {
	t.Parallel()

	// downtime is omitted — it must map to nil (unknown), not 0.
	metrics := []flink.MetricItem{{ID: "numRestarts", Value: "2"}}

	ri := mapRestartInfo(nil, metrics)
	if ri == nil {
		t.Fatal("expected non-nil RestartInfo")
	}
	if ri.DowntimeMs != nil {
		t.Errorf("downtimeMs should be nil when metric absent, got %v", *ri.DowntimeMs)
	}
	if ri.NumRestarts == nil || *ri.NumRestarts != 2 {
		t.Errorf("numRestarts = %v, want 2", ri.NumRestarts)
	}
}

func TestMapRestartInfo_ZeroRestartsNotNil(t *testing.T) {
	t.Parallel()

	ri := mapRestartInfo(nil, []flink.MetricItem{{ID: "numRestarts", Value: "0"}})
	if ri == nil || ri.NumRestarts == nil {
		t.Fatalf("numRestarts=0 should be present, got %+v", ri)
	}
	if *ri.NumRestarts != 0 {
		t.Errorf("numRestarts = %d, want 0", *ri.NumRestarts)
	}
}

func TestMapRestartInfo_AllAbsentReturnsNil(t *testing.T) {
	t.Parallel()

	if ri := mapRestartInfo(nil, nil); ri != nil {
		t.Errorf("expected nil when nothing is known, got %+v", ri)
	}
}
