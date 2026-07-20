package flink

import (
	"context"
	"log/slog"
	"math"
	"strconv"
	"sync"
	"time"
)

const defaultMetricSamplerInterval = time.Second

// V1 supported metric names. Subscribers may request any of these via the
// metricStream subscription; the resolver rejects unknown metric names.
const (
	MetricThroughput   = "throughput"
	MetricWatermarkLag = "watermarkLag"
)

// IsKnownMetric reports whether the metric name is one the sampler may
// emit. The resolver calls this to validate the subscription parameter.
func IsKnownMetric(metric string) bool {
	switch metric {
	case MetricThroughput, MetricWatermarkLag:
		return true
	default:
		return false
	}
}

// MetricEvent is published by the MetricSampler each tick when a metric is
// available. JobID is the empty string for cluster-wide aggregates.
type MetricEvent struct {
	ClusterID string
	JobID     string
	Metric    string
	Value     float64
	Timestamp time.Time
}

// MetricRatesSource abstracts the methods the sampler needs from Service.
// Production wires this to *flink.Service; tests pass a fake.
type MetricRatesSource interface {
	GetJobs(ctx context.Context) (*JobsOverview, error)
	GetJobRates(ctx context.Context, jobID string) (*JobDetailAggregate, error)
}

// MetricSamplerOption configures a MetricSampler.
type MetricSamplerOption func(*MetricSampler)

// WithMetricSamplerInterval overrides the default 1s tick.
func WithMetricSamplerInterval(d time.Duration) MetricSamplerOption {
	return func(s *MetricSampler) { s.interval = d }
}

// WithMetricSamplerLogger sets the sampler's logger.
func WithMetricSamplerLogger(l *slog.Logger) MetricSamplerOption {
	return func(s *MetricSampler) { s.logger = l }
}

// MetricSamplerListener wraps the underlying event-bus listener with
// ref-counting so the sampler can stop when the last subscriber disconnects.
type MetricSamplerListener struct {
	inner *Listener[MetricEvent]
	s     *MetricSampler
	once  sync.Once
}

// Updates returns the channel that delivers metric events.
func (l *MetricSamplerListener) Updates() <-chan MetricEvent {
	return l.inner.Updates()
}

// Close unsubscribes from the bus and decrements the sampler's subscriber
// count. The sampler stops when the count reaches zero.
func (l *MetricSamplerListener) Close() {
	l.once.Do(func() {
		l.inner.Close()
		l.s.unsubscribe()
	})
}

// MetricSampler periodically samples per-cluster + per-job throughput and
// watermark-lag aggregates and publishes them on an event bus. The sampler
// starts lazily on the first subscriber and stops on the last unsubscribe,
// so an idle cluster pays no CPU / REST cost.
type MetricSampler struct {
	clusterID string
	source    MetricRatesSource
	interval  time.Duration
	logger    *slog.Logger

	bus *EventBus[MetricEvent]

	mu     sync.Mutex
	cancel context.CancelFunc
	subs   int
}

// NewMetricSampler creates a sampler for the given cluster. The sampler
// stays idle until the first Subscribe call.
func NewMetricSampler(clusterID string, source MetricRatesSource, opts ...MetricSamplerOption) *MetricSampler {
	s := &MetricSampler{
		clusterID: clusterID,
		source:    source,
		interval:  defaultMetricSamplerInterval,
		logger:    slog.Default(),
		bus:       NewEventBus[MetricEvent](),
	}
	for _, o := range opts {
		o(s)
	}
	return s
}

// metricSamplerBufferSize matches the worst-case per-tick fan-out: per-job
// throughput + watermark for several jobs + the cluster-wide rollup. A
// buffer of 64 absorbs a typical-sized cluster's burst without dropping
// events on a momentary consumer stall.
const metricSamplerBufferSize = 64

// Subscribe registers a listener and starts the sampler on the first call.
func (s *MetricSampler) Subscribe() *MetricSamplerListener {
	s.mu.Lock()
	defer s.mu.Unlock()

	listener := s.bus.SubscribeBuffered(metricSamplerBufferSize)
	s.subs++

	if s.subs == 1 {
		s.startLocked()
	}

	return &MetricSamplerListener{inner: listener, s: s}
}

// SubscriberCount returns the active subscriber count.
func (s *MetricSampler) SubscriberCount() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.subs
}

// Stop stops the sampler unconditionally. Safe to call repeatedly.
func (s *MetricSampler) Stop() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.stopLocked()
}

func (s *MetricSampler) unsubscribe() {
	s.mu.Lock()
	defer s.mu.Unlock()

	s.subs--
	if s.subs <= 0 {
		s.subs = 0
		s.stopLocked()
	}
}

func (s *MetricSampler) startLocked() {
	ctx, cancel := context.WithCancel(context.Background())
	s.cancel = cancel
	go s.run(ctx)
}

func (s *MetricSampler) stopLocked() {
	if s.cancel != nil {
		s.cancel()
		s.cancel = nil
	}
}

func (s *MetricSampler) run(ctx context.Context) {
	ticker := time.NewTicker(s.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.sample(ctx)
		}
	}
}

// sample reads the current running-job set and pulls each job's cached
// rates aggregate. Because GetJobRates is backed by RatesCache (TTL 3s),
// a 1s sampler tick translates to ~1 REST fan-out every 3s per job — the
// cache absorbs the difference. Per-job events publish first; the
// cluster-wide rollup publishes last so subscribers receive a consistent
// snapshot.
func (s *MetricSampler) sample(ctx context.Context) {
	jobs, err := s.source.GetJobs(ctx)
	if err != nil {
		if ctx.Err() == nil {
			s.logger.Debug(
				"metric sampler: jobs fetch failed",
				"cluster", s.clusterID,
				"error", err,
			)
		}
		return
	}

	now := time.Now()
	var (
		clusterThroughput   float64
		clusterMinWatermark int64 = math.MaxInt64
		foundWatermark      bool
	)

	for _, job := range jobs.Jobs {
		if job.State != "RUNNING" {
			continue
		}

		agg, err := s.source.GetJobRates(ctx, job.JID)
		if err != nil {
			continue
		}

		throughput := jobThroughputRate(agg)
		clusterThroughput += throughput
		s.bus.Publish(MetricEvent{
			ClusterID: s.clusterID,
			JobID:     job.JID,
			Metric:    MetricThroughput,
			Value:     throughput,
			Timestamp: now,
		})

		if lag, ok := jobWatermarkLagMs(agg, now); ok {
			s.bus.Publish(MetricEvent{
				ClusterID: s.clusterID,
				JobID:     job.JID,
				Metric:    MetricWatermarkLag,
				Value:     float64(lag),
				Timestamp: now,
			})
		}

		if wm, ok := jobMinWatermark(agg); ok && wm < clusterMinWatermark {
			clusterMinWatermark = wm
			foundWatermark = true
		}
	}

	s.bus.Publish(MetricEvent{
		ClusterID: s.clusterID,
		JobID:     "",
		Metric:    MetricThroughput,
		Value:     clusterThroughput,
		Timestamp: now,
	})

	if foundWatermark {
		lag := max(now.UnixMilli()-clusterMinWatermark, 0)
		s.bus.Publish(MetricEvent{
			ClusterID: s.clusterID,
			JobID:     "",
			Metric:    MetricWatermarkLag,
			Value:     float64(lag),
			Timestamp: now,
		})
	}
}

// jobThroughputRate sums numRecordsOutPerSecond across the job's source
// vertices — the rate at which records enter the pipeline. Matches the
// per-job throughput exposed in the `jobs` resolver.
func jobThroughputRate(agg *JobDetailAggregate) float64 {
	if agg == nil || agg.Job == nil || len(agg.VertexRates) == 0 {
		return 0
	}
	var rate float64
	for _, n := range agg.Job.Plan.Nodes {
		if len(n.Inputs) != 0 {
			continue
		}
		rate += extractAggregatedSum(agg.VertexRates[n.ID], "numRecordsOutPerSecond")
	}
	return rate
}

// extractAggregatedSum returns the `sum` of the named aggregated subtask
// metric, treating non-finite values as zero.
func extractAggregatedSum(items []AggregatedSubtaskMetric, id string) float64 {
	for _, m := range items {
		if m.ID != id {
			continue
		}
		if math.IsNaN(m.Sum) || math.IsInf(m.Sum, 0) {
			return 0
		}
		return m.Sum
	}
	return 0
}

// jobWatermarkLagMs returns `now - min(valid subtask watermark)` in ms,
// or (0, false) when no valid watermark exists.
func jobWatermarkLagMs(agg *JobDetailAggregate, now time.Time) (int64, bool) {
	wm, ok := jobMinWatermark(agg)
	if !ok {
		return 0, false
	}
	lag := max(now.UnixMilli()-wm, 0)
	return lag, true
}

// jobMinWatermark finds the smallest valid subtask watermark across the
// job's vertices. Filters Flink sentinels (Long.MIN_VALUE = "no watermark",
// Long.MAX_VALUE = "end of stream") and non-positive values.
func jobMinWatermark(agg *JobDetailAggregate) (int64, bool) {
	if agg == nil || agg.Job == nil || len(agg.Watermarks) == 0 {
		return 0, false
	}
	const (
		longMin int64 = math.MinInt64
		longMax int64 = math.MaxInt64
	)
	minWatermark := longMax
	found := false
	for _, entries := range agg.Watermarks {
		for _, e := range entries {
			v, err := strconv.ParseInt(e.Value, 10, 64)
			if err != nil || v <= 0 || v == longMin || v == longMax {
				continue
			}
			if v < minWatermark {
				minWatermark = v
				found = true
			}
		}
	}
	if !found {
		return 0, false
	}
	return minWatermark, true
}
