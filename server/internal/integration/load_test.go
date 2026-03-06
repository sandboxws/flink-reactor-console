package integration

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

func TestLoad_TwoPhaseAggregation_50Vertices(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping load test in short mode")
	}

	const (
		numVertices     = 50
		latencyPerReq   = 50 * time.Millisecond
		maxTotalLatency = 5 * time.Second
		maxConcurrent   = 10
	)

	var concurrentCount atomic.Int32
	var peakConcurrent atomic.Int32

	// Build a mock server with 50 vertices and simulated latency on vertex endpoints.
	mux := http.NewServeMux()

	// Job detail endpoint returns a job with 50 vertices.
	vertices := make([]map[string]any, numVertices)
	for i := range numVertices {
		vertices[i] = map[string]any{
			"id":             fmt.Sprintf("vertex-%03d", i),
			"name":           fmt.Sprintf("Operator-%d", i),
			"maxParallelism": 128,
			"parallelism":    4,
			"status":         "RUNNING",
			"start-time":     time.Now().UnixMilli() - 60000,
			"end-time":       -1,
			"duration":       60000,
			"tasks":          map[string]int{"RUNNING": 4},
			"metrics": map[string]any{
				"read-bytes":                     1000,
				"read-bytes-complete":            true,
				"write-bytes":                    2000,
				"write-bytes-complete":           true,
				"read-records":                   500,
				"read-records-complete":          true,
				"write-records":                  600,
				"write-records-complete":         true,
				"accumulated-backpressured-time": 0,
				"accumulated-idle-time":          0,
				"accumulated-busy-time":          60000,
			},
		}
	}

	mux.HandleFunc("GET /jobs/{id}", func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jid":        "load-test-job",
			"name":       "LoadTestJob",
			"state":      "RUNNING",
			"start-time": time.Now().UnixMilli() - 60000,
			"end-time":   -1,
			"duration":   60000,
			"now":        time.Now().UnixMilli(),
			"vertices":   vertices,
			"plan": map[string]any{
				"jid":   "load-test-job",
				"name":  "LoadTestJob",
				"type":  "STREAMING",
				"nodes": []any{},
			},
		})
	})

	mux.HandleFunc("GET /jobs/{id}/exceptions", func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"root-exception":    nil,
			"all-exceptions":    []any{},
			"truncated":         false,
			"exception-history": map[string]any{"entries": []any{}, "truncated": false},
		})
	})

	mux.HandleFunc("GET /jobs/{id}/checkpoints", func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"counts":  map[string]int{"completed": 0, "in_progress": 0, "failed": 0, "total": 0, "restored": 0},
			"history": []any{},
		})
	})

	mux.HandleFunc("GET /jobs/{id}/checkpoints/config", func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"mode":                  "EXACTLY_ONCE",
			"interval":              60000,
			"timeout":               600000,
			"min_pause":             0,
			"max_concurrent":        1,
			"externalization":       map[string]any{"enabled": false, "delete_on_cancellation": false},
			"unaligned_checkpoints": false,
		})
	})

	mux.HandleFunc("GET /jobs/{id}/config", func(w http.ResponseWriter, _ *http.Request) {
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"jid":              "load-test-job",
			"name":             "LoadTestJob",
			"execution-config": map[string]any{},
		})
	})

	// Vertex endpoints with latency + concurrent tracking.
	vertexHandler := func(w http.ResponseWriter, r *http.Request) {
		cur := concurrentCount.Add(1)
		defer concurrentCount.Add(-1)

		// Track peak concurrency.
		for {
			peak := peakConcurrent.Load()
			if cur <= peak || peakConcurrent.CompareAndSwap(peak, cur) {
				break
			}
		}

		time.Sleep(latencyPerReq)
		vid := r.PathValue("vid")
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"id":          vid,
			"name":        "Operator",
			"parallelism": 4,
			"now":         time.Now().UnixMilli(),
			"subtasks":    []any{},
		})
	}

	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}", vertexHandler)
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/watermarks", func(w http.ResponseWriter, _ *http.Request) {
		cur := concurrentCount.Add(1)
		defer concurrentCount.Add(-1)
		for {
			peak := peakConcurrent.Load()
			if cur <= peak || peakConcurrent.CompareAndSwap(peak, cur) {
				break
			}
		}
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode([]map[string]string{{"id": "0", "value": "-9223372036854775808"}})
	})

	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/backpressure", func(w http.ResponseWriter, _ *http.Request) {
		cur := concurrentCount.Add(1)
		defer concurrentCount.Add(-1)
		for {
			peak := peakConcurrent.Load()
			if cur <= peak || peakConcurrent.CompareAndSwap(peak, cur) {
				break
			}
		}
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{
			"status": "ok", "backpressure-level": "ok", "end-timestamp": time.Now().UnixMilli(), "subtasks": []any{},
		})
	})

	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/accumulators", func(w http.ResponseWriter, _ *http.Request) {
		cur := concurrentCount.Add(1)
		defer concurrentCount.Add(-1)
		for {
			peak := peakConcurrent.Load()
			if cur <= peak || peakConcurrent.CompareAndSwap(peak, cur) {
				break
			}
		}
		time.Sleep(latencyPerReq)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"id": "", "user-accumulators": []any{}})
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	start := time.Now()
	result, err := agg.JobDetail(context.Background(), "load-test-job")
	elapsed := time.Since(start)

	if err != nil {
		t.Fatalf("aggregator error: %v", err)
	}
	if result.Job == nil {
		t.Fatal("expected job to be non-nil")
	}
	if len(result.VertexDetails) != numVertices {
		t.Errorf("expected %d vertex details, got %d", numVertices, len(result.VertexDetails))
	}

	t.Logf("Elapsed: %v (threshold: %v)", elapsed, maxTotalLatency)
	if elapsed > maxTotalLatency {
		t.Errorf("total duration %v exceeded threshold %v", elapsed, maxTotalLatency)
	}

	peak := peakConcurrent.Load()
	t.Logf("Peak concurrent requests: %d (limit: %d)", peak, maxConcurrent)
	if peak > int32(maxConcurrent) {
		t.Errorf("peak concurrent requests %d exceeded limit %d", peak, maxConcurrent)
	}
}
