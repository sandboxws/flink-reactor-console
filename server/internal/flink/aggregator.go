// Package flink provides the Flink REST API client, aggregator, and service layer.
package flink

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
)

// TM metric IDs fetched in a single call (30 metrics).
var tmMetricIDs = []string{
	"Status.JVM.CPU.Load",
	"Status.JVM.Memory.Heap.Used",
	"Status.JVM.Memory.Heap.Committed",
	"Status.JVM.Memory.Heap.Max",
	"Status.JVM.Memory.NonHeap.Used",
	"Status.JVM.Memory.NonHeap.Committed",
	"Status.JVM.Memory.NonHeap.Max",
	"Status.JVM.Memory.Direct.Count",
	"Status.JVM.Memory.Direct.MemoryUsed",
	"Status.JVM.Memory.Direct.TotalCapacity",
	"Status.JVM.Memory.Mapped.Count",
	"Status.JVM.Memory.Mapped.MemoryUsed",
	"Status.JVM.Memory.Mapped.TotalCapacity",
	"Status.Shuffle.Netty.AvailableMemory",
	"Status.Shuffle.Netty.UsedMemory",
	"Status.Shuffle.Netty.TotalMemory",
	"Status.Shuffle.Netty.AvailableMemorySegments",
	"Status.Shuffle.Netty.UsedMemorySegments",
	"Status.Shuffle.Netty.TotalMemorySegments",
	"Status.Flink.Memory.Managed.Used",
	"Status.Flink.Memory.Managed.Total",
	"Status.JVM.Memory.Metaspace.Used",
	"Status.JVM.Memory.Metaspace.Max",
	"Status.JVM.Threads.Count",
	"Status.JVM.GarbageCollector.G1_Young_Generation.Count",
	"Status.JVM.GarbageCollector.G1_Young_Generation.Time",
	"Status.JVM.GarbageCollector.G1_Old_Generation.Count",
	"Status.JVM.GarbageCollector.G1_Old_Generation.Time",
	// Instantaneous GC rate (ms of GC per wall-clock second) — a leading
	// indicator of memory pressure, consumed by the GC_PRESSURE alert.
	"Status.JVM.GarbageCollector.G1_Young_Generation.TimeMsPerSecond",
	"Status.JVM.GarbageCollector.G1_Old_Generation.TimeMsPerSecond",
}

// TMMetricQuery is the pre-joined query string for TM metrics.
var TMMetricQuery = strings.Join(tmMetricIDs, ",")

// JM metric IDs fetched in a single call (13 metrics).
var jmMetricIDs = []string{
	"Status.JVM.Memory.Heap.Used",
	"Status.JVM.Memory.Heap.Max",
	"Status.JVM.Memory.NonHeap.Used",
	"Status.JVM.Memory.NonHeap.Max",
	"Status.JVM.Memory.Metaspace.Used",
	"Status.JVM.Memory.Metaspace.Max",
	"Status.JVM.Memory.Direct.MemoryUsed",
	"Status.JVM.Memory.Direct.TotalCapacity",
	"Status.JVM.Threads.Count",
	"Status.JVM.GarbageCollector.G1_Young_Generation.Count",
	"Status.JVM.GarbageCollector.G1_Young_Generation.Time",
	"Status.JVM.GarbageCollector.G1_Old_Generation.Count",
	"Status.JVM.GarbageCollector.G1_Old_Generation.Time",
}

// JMMetricQuery is the pre-joined query string for JM metrics.
var JMMetricQuery = strings.Join(jmMetricIDs, ",")

// Vertex metric IDs fetched per running vertex (8 metrics).
var vertexMetricIDs = []string{
	"numRecordsIn",
	"numRecordsOut",
	"numBytesIn",
	"numBytesOut",
	"numRecordsInPerSecond",
	"numRecordsOutPerSecond",
	"numBytesInPerSecond",
	"numBytesOutPerSecond",
}

// VertexMetricQuery is the pre-joined query string for vertex metrics.
var VertexMetricQuery = strings.Join(vertexMetricIDs, ",")

// Vertex rate metric IDs fetched per vertex during JobDetail aggregation.
// Smaller set than VertexMetricQuery — we only need the per-second rates
// to compute job-level throughput.
var vertexRateMetricIDs = []string{
	"numRecordsInPerSecond",
	"numRecordsOutPerSecond",
}

// VertexRateMetricQuery is the pre-joined query string for vertex rate metrics.
var VertexRateMetricQuery = strings.Join(vertexRateMetricIDs, ",")

// Job-level reliability metric IDs fetched during JobDetail aggregation:
// restart counts and up/down time. Absent metrics are tolerated.
var jobMetricIDs = []string{
	"numRestarts",
	"fullRestarts",
	"uptime",
	"downtime",
}

// JobMetricQuery is the pre-joined query string for job-level reliability metrics.
var JobMetricQuery = strings.Join(jobMetricIDs, ",")

// JobDetailAggregate holds the result of a two-phase job detail aggregation.
type JobDetailAggregate struct {
	Job              *JobDetail
	Exceptions       *JobExceptions
	Checkpoints      *CheckpointStats
	CheckpointConfig *CheckpointConfig
	JobConfig        *JobConfig
	VertexDetails    map[string]*VertexDetail
	Watermarks       map[string]Watermarks
	BackPressure     map[string]*BackPressure
	Accumulators     map[string]*Accumulators
	// VertexRates holds per-vertex per-second rate metrics aggregated across
	// the vertex's subtasks (numRecordsInPerSecond / numRecordsOutPerSecond),
	// used to compute job-level throughput. Keyed by vertex ID.
	VertexRates map[string][]AggregatedSubtaskMetric
	// RestartMetrics holds job-level reliability metrics (numRestarts,
	// fullRestarts, uptime, downtime). Best-effort; empty when unavailable.
	RestartMetrics []MetricItem
}

// TMDetailAggregate holds the result of a TM detail aggregation.
type TMDetailAggregate struct {
	Detail  *TaskManagerItem
	Metrics []MetricItem
}

// JMDetailAggregate holds the result of a JM detail aggregation.
type JMDetailAggregate struct {
	Config      []JMConfigEntry
	Environment *JMEnvironment
	Metrics     []MetricItem
}

// Aggregator composes multiple Flink REST calls into aggregate responses
// using structured concurrency via errgroup.
type Aggregator struct {
	client *Client
}

// NewAggregator creates an Aggregator backed by the given Flink client.
func NewAggregator(client *Client) *Aggregator {
	return &Aggregator{client: client}
}

// JobDetail fetches a full job detail aggregate using two-phase concurrency.
//
// Phase 1: job overview and exceptions are fetched as critical (any failure
// cancels the request). Checkpoints, checkpoint config, and job config are
// supplementary (fallback to nil on failure — config 404s/500s should not blank
// the entire detail page; SQL jobs without checkpointing 404 their checkpoints).
//
// Phase 2 (per-vertex): vertex detail (critical), watermarks, backpressure, and
// accumulators are fetched in parallel with SetLimit(10). Supplementary fetches
// (watermarks, backpressure, accumulators) use fallback values on failure.
//
// Phase 2 uses the caller's original context, NOT the Phase 1 errgroup context,
// because the Phase 1 context is cancelled after Wait() returns.
func (a *Aggregator) JobDetail(ctx context.Context, jobID string) (*JobDetailAggregate, error) {
	var (
		job            JobDetail
		exceptions     JobExceptions
		checkpts       *CheckpointStats
		cpConfig       *CheckpointConfig
		jobCfg         *JobConfig
		restartMetrics []MetricItem
	)

	// Phase 1: critical fetches — fail fast on any error.
	g1, ctx1 := errgroup.WithContext(ctx)

	g1.Go(func() error {
		return a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s", jobID), &job)
	})
	g1.Go(func() error {
		return a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/exceptions", jobID), &exceptions)
	})

	// Supplementary: checkpoints may 404 for SQL jobs without checkpointing.
	g1.Go(func() error {
		var cp CheckpointStats
		if err := a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/checkpoints", jobID), &cp); err == nil {
			checkpts = &cp
		}
		return nil
	})
	g1.Go(func() error {
		var cc CheckpointConfig
		if err := a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/checkpoints/config", jobID), &cc); err == nil {
			cpConfig = &cc
		}
		return nil
	})

	// Supplementary: job config — flakes on this endpoint must not blank the page.
	g1.Go(func() error {
		var jc JobConfig
		if err := a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/config", jobID), &jc); err == nil {
			jobCfg = &jc
		}
		return nil
	})

	// Supplementary: job-level reliability metrics (restarts / uptime).
	// Best-effort — never fail the page if the metrics endpoint flakes.
	g1.Go(func() error {
		var m []MetricItem
		if err := a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/metrics?get=%s", jobID, JobMetricQuery), &m); err == nil {
			restartMetrics = m
		}
		return nil
	})

	if err := g1.Wait(); err != nil {
		return nil, fmt.Errorf("job detail phase 1: %w", err)
	}

	// Extract vertex IDs from Phase 1 results.
	vertexIDs := make([]string, len(job.Vertices))
	for i, v := range job.Vertices {
		vertexIDs[i] = v.ID
	}

	// Phase 2: per-vertex fetches — use original ctx (not ctx1 which is now cancelled).
	var (
		mu           sync.Mutex
		vertexDetail = make(map[string]*VertexDetail, len(vertexIDs))
		watermarks   = make(map[string]Watermarks, len(vertexIDs))
		backpressure = make(map[string]*BackPressure, len(vertexIDs))
		accumulators = make(map[string]*Accumulators, len(vertexIDs))
		vertexRates  = make(map[string][]AggregatedSubtaskMetric, len(vertexIDs))
	)

	g2 := new(errgroup.Group)
	g2.SetLimit(10)

	for _, vid := range vertexIDs {
		vid := vid // capture loop var

		// Vertex detail — critical: errors propagate.
		g2.Go(func() error {
			var vd VertexDetail
			if err := a.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s", jobID, vid), &vd); err != nil {
				return fmt.Errorf("vertex detail %s: %w", vid, err)
			}
			mu.Lock()
			vertexDetail[vid] = &vd
			mu.Unlock()
			return nil
		})

		// Watermarks — supplementary: fallback to empty slice.
		g2.Go(func() error {
			var wm Watermarks
			if err := a.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s/watermarks", jobID, vid), &wm); err != nil {
				wm = Watermarks{}
			}
			mu.Lock()
			watermarks[vid] = wm
			mu.Unlock()
			return nil
		})

		// Backpressure — supplementary: fallback to default.
		g2.Go(func() error {
			var bp BackPressure
			if err := a.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s/backpressure", jobID, vid), &bp); err != nil {
				bp = BackPressure{
					Status:            "ok",
					BackpressureLevel: "ok",
				}
			}
			mu.Lock()
			backpressure[vid] = &bp
			mu.Unlock()
			return nil
		})

		// Accumulators — supplementary: fallback to empty.
		g2.Go(func() error {
			var acc Accumulators
			if err := a.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s/accumulators", jobID, vid), &acc); err != nil {
				acc = Accumulators{}
			}
			mu.Lock()
			accumulators[vid] = &acc
			mu.Unlock()
			return nil
		})

		// Per-vertex rate metrics — supplementary: fallback to empty.
		// Uses the /subtasks/metrics endpoint which returns values aggregated
		// across all subtasks (sum/min/max/avg/skew). Used to compute
		// job-level throughput from the `sum` field.
		g2.Go(func() error {
			var rates []AggregatedSubtaskMetric
			url := fmt.Sprintf("/jobs/%s/vertices/%s/subtasks/metrics?get=%s", jobID, vid, VertexRateMetricQuery)
			if err := a.client.GetJSON(ctx, url, &rates); err != nil {
				rates = nil
			}
			mu.Lock()
			vertexRates[vid] = rates
			mu.Unlock()
			return nil
		})
	}

	if err := g2.Wait(); err != nil {
		return nil, fmt.Errorf("job detail phase 2: %w", err)
	}

	return &JobDetailAggregate{
		Job:              &job,
		Exceptions:       &exceptions,
		Checkpoints:      checkpts,
		CheckpointConfig: cpConfig,
		JobConfig:        jobCfg,
		VertexDetails:    vertexDetail,
		Watermarks:       watermarks,
		BackPressure:     backpressure,
		Accumulators:     accumulators,
		VertexRates:      vertexRates,
		RestartMetrics:   restartMetrics,
	}, nil
}

// JobRates fetches the lightweight subset of JobDetail needed to compute
// per-job throughput and watermark lag: the job's plan (for source/sink
// classification) plus per-vertex rate metrics and watermarks. It exists
// so the `jobs` list resolver can populate rates without paying for the
// full JobDetail aggregate (which also fetches exceptions, checkpoints,
// accumulators, vertex details, and backpressure).
//
// On per-vertex fetch failure (rate metrics or watermarks), the affected
// map entry is left empty — the rates compute treats missing data as
// "not yet reported" rather than an error.
func (a *Aggregator) JobRates(ctx context.Context, jobID string) (*JobDetailAggregate, error) {
	var job JobDetail
	if err := a.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s", jobID), &job); err != nil {
		return nil, fmt.Errorf("job rates: %w", err)
	}

	vertexIDs := make([]string, len(job.Vertices))
	for i, v := range job.Vertices {
		vertexIDs[i] = v.ID
	}

	var (
		mu          sync.Mutex
		vertexRates = make(map[string][]AggregatedSubtaskMetric, len(vertexIDs))
		watermarks  = make(map[string]Watermarks, len(vertexIDs))
	)

	g := new(errgroup.Group)
	g.SetLimit(10)

	for _, vid := range vertexIDs {
		g.Go(func() error {
			var rates []AggregatedSubtaskMetric
			url := fmt.Sprintf("/jobs/%s/vertices/%s/subtasks/metrics?get=%s", jobID, vid, VertexRateMetricQuery)
			if err := a.client.GetJSON(ctx, url, &rates); err != nil {
				rates = nil
			}
			mu.Lock()
			vertexRates[vid] = rates
			mu.Unlock()
			return nil
		})

		g.Go(func() error {
			var wm Watermarks
			if err := a.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s/watermarks", jobID, vid), &wm); err != nil {
				wm = Watermarks{}
			}
			mu.Lock()
			watermarks[vid] = wm
			mu.Unlock()
			return nil
		})
	}

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("job rates fan-out: %w", err)
	}

	return &JobDetailAggregate{
		Job:         &job,
		VertexRates: vertexRates,
		Watermarks:  watermarks,
	}, nil
}

// TMDetail fetches task manager detail and 28 JVM metrics in parallel.
func (a *Aggregator) TMDetail(ctx context.Context, tmID string) (*TMDetailAggregate, error) {
	var (
		detail  TaskManagerItem
		metrics []MetricItem
	)

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		return a.client.GetJSON(ctx, fmt.Sprintf("/taskmanagers/%s", tmID), &detail)
	})
	g.Go(func() error {
		return a.client.GetJSON(ctx, fmt.Sprintf("/taskmanagers/%s/metrics?get=%s", tmID, TMMetricQuery), &metrics)
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("tm detail: %w", err)
	}

	return &TMDetailAggregate{
		Detail:  &detail,
		Metrics: metrics,
	}, nil
}

// JMDetail fetches job manager config, environment, and 13 JVM metrics in parallel.
func (a *Aggregator) JMDetail(ctx context.Context) (*JMDetailAggregate, error) {
	var (
		config      []JMConfigEntry
		environment JMEnvironment
		metrics     []MetricItem
	)

	g, ctx := errgroup.WithContext(ctx)

	g.Go(func() error {
		return a.client.GetJSON(ctx, "/jobmanager/config", &config)
	})
	g.Go(func() error {
		return a.client.GetJSON(ctx, "/jobmanager/environment", &environment)
	})
	g.Go(func() error {
		return a.client.GetJSON(ctx, fmt.Sprintf("/jobmanager/metrics?get=%s", JMMetricQuery), &metrics)
	})

	if err := g.Wait(); err != nil {
		return nil, fmt.Errorf("jm detail: %w", err)
	}

	return &JMDetailAggregate{
		Config:      config,
		Environment: &environment,
		Metrics:     metrics,
	}, nil
}
