package flink

import (
	"context"
	"sync"
	"testing"
	"time"
)

// mockMetricSource implements MetricRatesSource for sampler tests.
type mockMetricSource struct {
	mu       sync.Mutex
	jobs     []JobOverview
	rates    map[string]*JobDetailAggregate
	jobCalls int
}

func (m *mockMetricSource) GetJobs(_ context.Context) (*JobsOverview, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobCalls++
	out := make([]JobOverview, len(m.jobs))
	copy(out, m.jobs)
	return &JobsOverview{Jobs: out}, nil
}

func (m *mockMetricSource) GetJobRates(_ context.Context, jobID string) (*JobDetailAggregate, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.rates[jobID], nil
}

func (m *mockMetricSource) setJobs(jobs []JobOverview) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.jobs = jobs
}

func (m *mockMetricSource) setRates(jobID string, agg *JobDetailAggregate) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.rates == nil {
		m.rates = make(map[string]*JobDetailAggregate)
	}
	m.rates[jobID] = agg
}

func (m *mockMetricSource) getJobCalls() int {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.jobCalls
}

// fixtureRates builds a simple JobDetailAggregate where the single source
// vertex "src" emits `recordsOut` records/sec.
func fixtureRates(jobID string, recordsOut float64) *JobDetailAggregate {
	return &JobDetailAggregate{
		Job: &JobDetail{
			JID:  jobID,
			Plan: JobPlan{Nodes: []PlanNode{{ID: "src", Inputs: nil}}},
		},
		VertexRates: map[string][]AggregatedSubtaskMetric{
			"src": {
				{ID: "numRecordsOutPerSecond", Sum: recordsOut},
			},
		},
	}
}

func TestMetricSampler_PublishesAtConfiguredInterval(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs([]JobOverview{{JID: "j1", Name: "job1", State: "RUNNING"}})
	src.setRates("j1", fixtureRates("j1", 100))

	sampler := NewMetricSampler("c1", src, WithMetricSamplerInterval(30*time.Millisecond))
	defer sampler.Stop()

	listener := sampler.Subscribe()
	defer listener.Close()

	// Collect 3 cluster-wide throughput events; each tick emits per-job +
	// cluster-wide, so we read more than 3 events and filter.
	events := drainEvents(t, listener, 6, 500*time.Millisecond)

	clusterWide := 0
	for _, evt := range events {
		if evt.JobID == "" && evt.Metric == MetricThroughput {
			clusterWide++
			if evt.Value != 100 {
				t.Errorf("expected cluster-wide throughput 100, got %f", evt.Value)
			}
			if evt.ClusterID != "c1" {
				t.Errorf("expected clusterID c1, got %s", evt.ClusterID)
			}
		}
	}
	if clusterWide < 2 {
		t.Errorf("expected at least 2 cluster-wide throughput events, got %d", clusterWide)
	}
}

func TestMetricSampler_DoesNotSampleWithoutSubscribers(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs([]JobOverview{{JID: "j1", Name: "job1", State: "RUNNING"}})
	src.setRates("j1", fixtureRates("j1", 1))

	sampler := NewMetricSampler("c1", src, WithMetricSamplerInterval(20*time.Millisecond))
	defer sampler.Stop()

	// Wait longer than several intervals — no Subscribe call means no work.
	time.Sleep(150 * time.Millisecond)

	if calls := src.getJobCalls(); calls != 0 {
		t.Errorf("expected 0 GetJobs calls without subscribers, got %d", calls)
	}
}

func TestMetricSampler_StopsAfterLastSubscriberDisconnects(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs([]JobOverview{{JID: "j1", Name: "job1", State: "RUNNING"}})
	src.setRates("j1", fixtureRates("j1", 1))

	sampler := NewMetricSampler("c1", src, WithMetricSamplerInterval(20*time.Millisecond))
	defer sampler.Stop()

	l1 := sampler.Subscribe()
	l2 := sampler.Subscribe()

	if got := sampler.SubscriberCount(); got != 2 {
		t.Fatalf("expected 2 subscribers, got %d", got)
	}

	l1.Close()
	if got := sampler.SubscriberCount(); got != 1 {
		t.Fatalf("expected 1 subscriber after first close, got %d", got)
	}

	l2.Close()
	if got := sampler.SubscriberCount(); got != 0 {
		t.Fatalf("expected 0 subscribers after second close, got %d", got)
	}

	// After both unsubscribe, calls should not increase further.
	callsBefore := src.getJobCalls()
	time.Sleep(100 * time.Millisecond)
	callsAfter := src.getJobCalls()
	if callsAfter != callsBefore {
		t.Errorf("sampler kept calling GetJobs after last unsubscribe: %d → %d", callsBefore, callsAfter)
	}

	// Re-subscribing should restart the sampler.
	l3 := sampler.Subscribe()
	defer l3.Close()
	if got := sampler.SubscriberCount(); got != 1 {
		t.Fatalf("expected 1 subscriber after re-subscribe, got %d", got)
	}
}

func TestMetricSampler_PublishesPerJobAndClusterWide(t *testing.T) {
	src := &mockMetricSource{}
	src.setJobs([]JobOverview{
		{JID: "j1", Name: "job1", State: "RUNNING"},
		{JID: "j2", Name: "job2", State: "RUNNING"},
	})
	src.setRates("j1", fixtureRates("j1", 50))
	src.setRates("j2", fixtureRates("j2", 75))

	sampler := NewMetricSampler("c1", src, WithMetricSamplerInterval(30*time.Millisecond))
	defer sampler.Stop()

	listener := sampler.Subscribe()
	defer listener.Close()

	// The bus buffer is 1, so each tick the listener may observe only one of
	// the three throughput events the sampler emits. Read across many ticks
	// to give each variant (j1, j2, cluster) a chance to land in the buffer.
	events := drainEvents(t, listener, 30, time.Second)

	byJob := map[string]float64{}
	for _, evt := range events {
		if evt.Metric != MetricThroughput {
			continue
		}
		byJob[evt.JobID] = evt.Value
	}

	if got, ok := byJob["j1"]; !ok || got != 50 {
		t.Errorf("expected j1 throughput 50 in stream, got %f (present=%v)", got, ok)
	}
	if got, ok := byJob["j2"]; !ok || got != 75 {
		t.Errorf("expected j2 throughput 75 in stream, got %f (present=%v)", got, ok)
	}
	if got, ok := byJob[""]; !ok || got != 125 {
		t.Errorf("expected cluster-wide throughput 125 (50+75) in stream, got %f (present=%v)", got, ok)
	}
}

func TestIsKnownMetric(t *testing.T) {
	cases := []struct {
		metric string
		want   bool
	}{
		{MetricThroughput, true},
		{MetricWatermarkLag, true},
		// checkpointRate was advertised but never emitted; it is no longer
		// a known metric.
		{"checkpointRate", false},
		{"unknown", false},
		{"", false},
	}
	for _, c := range cases {
		if got := IsKnownMetric(c.metric); got != c.want {
			t.Errorf("IsKnownMetric(%q) = %v, want %v", c.metric, got, c.want)
		}
	}
}

// drainEvents reads up to `count` events from the listener within `timeout`.
// Returns whatever it collected; callers assert on the contents.
func drainEvents(t *testing.T, l *MetricSamplerListener, count int, timeout time.Duration) []MetricEvent {
	t.Helper()
	deadline := time.After(timeout)
	out := make([]MetricEvent, 0, count)
	for len(out) < count {
		select {
		case evt, ok := <-l.Updates():
			if !ok {
				return out
			}
			out = append(out, evt)
		case <-deadline:
			return out
		}
	}
	return out
}
