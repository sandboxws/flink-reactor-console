package graphql

import (
	"math"
	"strconv"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
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
		"pipeline.name":         "demo",
		"flinkreactor.sql":      "SELECT 1",
		"pipeline.sql":          "INSERT INTO sink SELECT * FROM src",
		"execution.savepoint":   "/tmp/sp",
		"state.backend.rocksdb": "true",
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

// makePlan returns a 3-vertex plan: source -> map -> sink.
func makePlan() flink.JobPlan {
	return flink.JobPlan{
		Nodes: []flink.PlanNode{
			{ID: "v1", Operator: "Source: Kafka"},
			{ID: "v2", Operator: "Map", Inputs: []flink.PlanNodeInput{{ID: "v1"}}},
			{ID: "v3", Operator: "Sink: Iceberg", Inputs: []flink.PlanNodeInput{{ID: "v2"}}},
		},
	}
}

func TestComputeJobMetrics_SumsSourceAndSinkRates(t *testing.T) {
	t.Parallel()

	agg := &flink.JobDetailAggregate{
		Job: &flink.JobDetail{Plan: makePlan()},
		VertexRates: map[string][]flink.AggregatedSubtaskMetric{
			"v1": {
				{ID: "numRecordsInPerSecond", Sum: 0},
				{ID: "numRecordsOutPerSecond", Sum: 12500.5},
			},
			"v2": {
				{ID: "numRecordsInPerSecond", Sum: 12500},
				{ID: "numRecordsOutPerSecond", Sum: 12400},
			},
			"v3": {
				{ID: "numRecordsInPerSecond", Sum: 12400},
				{ID: "numRecordsOutPerSecond", Sum: 0},
			},
		},
	}

	got := computeJobMetrics(agg)
	if got == nil {
		t.Fatal("expected non-nil JobMetrics")
	}
	if got.RecordsInPerSecond != 12500.5 {
		t.Errorf("recordsInPerSecond: want 12500.5, got %v", got.RecordsInPerSecond)
	}
	if got.RecordsOutPerSecond != 12400 {
		t.Errorf("recordsOutPerSecond: want 12400, got %v", got.RecordsOutPerSecond)
	}
}

func TestComputeJobMetrics_NilWhenNoRates(t *testing.T) {
	t.Parallel()

	agg := &flink.JobDetailAggregate{
		Job: &flink.JobDetail{Plan: makePlan()},
	}
	if got := computeJobMetrics(agg); got != nil {
		t.Errorf("expected nil when VertexRates empty, got %+v", got)
	}
}

func TestClassifyVertices_DetectsSourceAndSink(t *testing.T) {
	t.Parallel()

	plan := makePlan()
	sources, sinks := classifyVertices(&plan)

	if len(sources) != 1 || sources[0] != "v1" {
		t.Errorf("sources: want [v1], got %v", sources)
	}
	// v3 is a sink because no one references it as input AND its operator starts with "Sink:".
	if len(sinks) != 1 || sinks[0] != "v3" {
		t.Errorf("sinks: want [v3], got %v", sinks)
	}
}

func TestComputeWatermarkLag_FiltersSentinels(t *testing.T) {
	t.Parallel()

	const now int64 = 1_709_251_205_000

	agg := &flink.JobDetailAggregate{
		Job: &flink.JobDetail{Now: now, Plan: makePlan()},
		Watermarks: map[string]flink.Watermarks{
			"v2": {
				// Long.MIN_VALUE — "no watermark yet"
				{ID: "0.currentInputWatermark", Value: strconv.FormatInt(math.MinInt64, 10)},
				// Long.MAX_VALUE — "end of stream"
				{ID: "1.currentInputWatermark", Value: strconv.FormatInt(math.MaxInt64, 10)},
				// Real watermark — 1.2s behind
				{ID: "2.currentInputWatermark", Value: strconv.FormatInt(now-1_200, 10)},
				// Older watermark — 5s behind (this is the min, so wins)
				{ID: "3.currentInputWatermark", Value: strconv.FormatInt(now-5_000, 10)},
				// Zero — must be skipped
				{ID: "4.currentInputWatermark", Value: "0"},
			},
		},
	}

	got := computeWatermarkLag(agg)
	if got == nil {
		t.Fatal("expected non-nil lag")
	}
	if *got != "5000" {
		t.Errorf("lag: want \"5000\", got %q", *got)
	}
}

func TestComputeWatermarkLag_NilWhenAllSentinels(t *testing.T) {
	t.Parallel()

	agg := &flink.JobDetailAggregate{
		Job: &flink.JobDetail{Now: 1_000_000, Plan: makePlan()},
		Watermarks: map[string]flink.Watermarks{
			"v2": {
				{ID: "0.currentInputWatermark", Value: strconv.FormatInt(math.MinInt64, 10)},
				{ID: "1.currentInputWatermark", Value: "0"},
			},
		},
	}

	if got := computeWatermarkLag(agg); got != nil {
		t.Errorf("expected nil lag when all values are sentinels, got %q", *got)
	}
}
