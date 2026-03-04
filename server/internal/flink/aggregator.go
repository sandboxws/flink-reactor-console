// Package flink provides the Flink REST API client, aggregator, and service layer.
package flink

import (
	"context"
	"fmt"
	"strings"
	"sync"

	"golang.org/x/sync/errgroup"
)

// TM metric IDs fetched in a single call (28 metrics).
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
// Phase 1 (critical): job overview, exceptions, checkpoints, checkpoint config,
// and job config are fetched in parallel. Any failure cancels all Phase 1 requests.
//
// Phase 2 (per-vertex): vertex detail (critical), watermarks, backpressure, and
// accumulators are fetched in parallel with SetLimit(10). Supplementary fetches
// (watermarks, backpressure, accumulators) use fallback values on failure.
//
// Phase 2 uses the caller's original context, NOT the Phase 1 errgroup context,
// because the Phase 1 context is cancelled after Wait() returns.
func (a *Aggregator) JobDetail(ctx context.Context, jobID string) (*JobDetailAggregate, error) {
	var (
		job        JobDetail
		exceptions JobExceptions
		checkpts   CheckpointStats
		cpConfig   CheckpointConfig
		jobCfg     JobConfig
	)

	// Phase 1: critical fetches — fail fast on any error.
	g1, ctx1 := errgroup.WithContext(ctx)

	g1.Go(func() error {
		return a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s", jobID), &job)
	})
	g1.Go(func() error {
		return a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/exceptions", jobID), &exceptions)
	})
	g1.Go(func() error {
		return a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/checkpoints", jobID), &checkpts)
	})
	g1.Go(func() error {
		return a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/checkpoints/config", jobID), &cpConfig)
	})
	g1.Go(func() error {
		return a.client.GetJSON(ctx1, fmt.Sprintf("/jobs/%s/config", jobID), &jobCfg)
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
	}

	if err := g2.Wait(); err != nil {
		return nil, fmt.Errorf("job detail phase 2: %w", err)
	}

	return &JobDetailAggregate{
		Job:              &job,
		Exceptions:       &exceptions,
		Checkpoints:      &checkpts,
		CheckpointConfig: &cpConfig,
		JobConfig:        &jobCfg,
		VertexDetails:    vertexDetail,
		Watermarks:       watermarks,
		BackPressure:     backpressure,
		Accumulators:     accumulators,
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
