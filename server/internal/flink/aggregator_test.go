package flink_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

func TestAggregator_JobDetail_Success(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	result, err := agg.JobDetail(context.Background(), "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	// Phase 1 results
	if result.Job == nil {
		t.Fatal("expected job to be non-nil")
	}
	if result.Job.JID != "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6" {
		t.Errorf("expected job ID d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6, got %s", result.Job.JID)
	}
	if result.Exceptions == nil {
		t.Fatal("expected exceptions to be non-nil")
	}
	if result.Checkpoints == nil {
		t.Fatal("expected checkpoints to be non-nil")
	}
	if result.CheckpointConfig == nil {
		t.Fatal("expected checkpoint config to be non-nil")
	}
	if result.CheckpointConfig.Mode != "EXACTLY_ONCE" {
		t.Errorf("expected checkpoint mode EXACTLY_ONCE, got %s", result.CheckpointConfig.Mode)
	}
	if result.JobConfig == nil {
		t.Fatal("expected job config to be non-nil")
	}

	// Phase 2 results — 4 vertices in the mock job
	if len(result.VertexDetails) != 4 {
		t.Errorf("expected 4 vertex details, got %d", len(result.VertexDetails))
	}
	if len(result.Watermarks) != 4 {
		t.Errorf("expected 4 watermark entries, got %d", len(result.Watermarks))
	}
	if len(result.BackPressure) != 4 {
		t.Errorf("expected 4 backpressure entries, got %d", len(result.BackPressure))
	}
	if len(result.Accumulators) != 4 {
		t.Errorf("expected 4 accumulator entries, got %d", len(result.Accumulators))
	}

	// Verify a specific vertex detail
	for _, vd := range result.VertexDetails {
		if len(vd.Subtasks) != 4 {
			t.Errorf("expected 4 subtasks, got %d", len(vd.Subtasks))
		}
		break
	}
}

func TestAggregator_JobDetail_Phase1_Failure(t *testing.T) {
	t.Parallel()

	// Create a server that returns 404 for job detail (simulating job not found).
	mux := http.NewServeMux()
	mux.HandleFunc("GET /jobs/{id}", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = w.Write([]byte(`{"errors": [{"message": "Job not found"}]}`))
	})
	// Other Phase 1 endpoints succeed.
	mux.HandleFunc("GET /jobs/{id}/exceptions", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockJobExceptions("test"))
	})
	mux.HandleFunc("GET /jobs/{id}/checkpoints", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockCheckpointStats("test"))
	})
	mux.HandleFunc("GET /jobs/{id}/checkpoints/config", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockCheckpointConfig())
	})
	mux.HandleFunc("GET /jobs/{id}/config", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockJobConfig("test"))
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	_, err := agg.JobDetail(context.Background(), "nonexistent")
	if err == nil {
		t.Fatal("expected error for Phase 1 failure")
	}
}

func TestAggregator_JobDetail_Phase2_SupplementaryFallback(t *testing.T) {
	t.Parallel()

	// Create a server where supplementary endpoints fail but vertex detail succeeds.
	mux := http.NewServeMux()

	// Phase 1 endpoints.
	mux.HandleFunc("GET /jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockJobDetail(r.PathValue("id")))
	})
	mux.HandleFunc("GET /jobs/{id}/exceptions", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockJobExceptions(r.PathValue("id")))
	})
	mux.HandleFunc("GET /jobs/{id}/checkpoints", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockCheckpointStats(r.PathValue("id")))
	})
	mux.HandleFunc("GET /jobs/{id}/checkpoints/config", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockCheckpointConfig())
	})
	mux.HandleFunc("GET /jobs/{id}/config", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockJobConfig(r.PathValue("id")))
	})

	// Phase 2: vertex detail succeeds.
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockVertexDetail(r.PathValue("vid")))
	})
	// Phase 2: supplementary endpoints return 500.
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/watermarks", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/backpressure", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/accumulators", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	result, err := agg.JobDetail(context.Background(), "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")
	if err != nil {
		t.Fatalf("expected supplementary fallback, got error: %v", err)
	}

	// Vertex details should be present.
	if len(result.VertexDetails) != 4 {
		t.Errorf("expected 4 vertex details, got %d", len(result.VertexDetails))
	}

	// Watermarks should be empty (fallback).
	for vid, wm := range result.Watermarks {
		if len(wm) != 0 {
			t.Errorf("expected empty watermarks fallback for %s, got %d entries", vid, len(wm))
		}
	}

	// Backpressure should have default values (fallback).
	for vid, bp := range result.BackPressure {
		if bp.Status != "ok" {
			t.Errorf("expected backpressure status 'ok' fallback for %s, got %s", vid, bp.Status)
		}
	}

	// Accumulators should be empty (fallback).
	for vid, acc := range result.Accumulators {
		if acc.ID != "" {
			t.Errorf("expected empty accumulator ID fallback for %s, got %s", vid, acc.ID)
		}
	}
}

func TestAggregator_JobDetail_Phase2_VertexDetailFailure(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()

	// Phase 1 endpoints all succeed.
	mux.HandleFunc("GET /jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockJobDetail(r.PathValue("id")))
	})
	mux.HandleFunc("GET /jobs/{id}/exceptions", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockJobExceptions(r.PathValue("id")))
	})
	mux.HandleFunc("GET /jobs/{id}/checkpoints", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockCheckpointStats(r.PathValue("id")))
	})
	mux.HandleFunc("GET /jobs/{id}/checkpoints/config", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockCheckpointConfig())
	})
	mux.HandleFunc("GET /jobs/{id}/config", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockJobConfig(r.PathValue("id")))
	})

	// Phase 2: vertex detail fails.
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"errors": [{"message": "Vertex not found"}]}`))
	})
	// Supplementary succeed (but shouldn't matter since vertex detail fails).
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/watermarks", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockWatermarks(r.PathValue("vid")))
	})
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/backpressure", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockBackPressure())
	})
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/accumulators", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockAccumulators(r.PathValue("vid")))
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	_, err := agg.JobDetail(context.Background(), "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")
	if err == nil {
		t.Fatal("expected error when vertex detail fails")
	}
}

func TestAggregator_JobDetail_ContextCancellation(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	ctx, cancel := context.WithCancel(context.Background())
	cancel() // cancel immediately

	_, err := agg.JobDetail(ctx, "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")
	if err == nil {
		t.Fatal("expected error for cancelled context")
	}
}

func TestAggregator_TMDetail_Success(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	result, err := agg.TMDetail(context.Background(), "tm-00000000000000000000000000000001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.Detail == nil {
		t.Fatal("expected detail to be non-nil")
	}
	if result.Detail.ID != "tm-00000000000000000000000000000001" {
		t.Errorf("expected TM ID tm-00000000000000000000000000000001, got %s", result.Detail.ID)
	}
	if len(result.Metrics) != 28 {
		t.Errorf("expected 28 TM metrics, got %d", len(result.Metrics))
	}
}

func TestAggregator_TMDetail_MetricFailure(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /taskmanagers/{id}", func(w http.ResponseWriter, r *http.Request) {
		writeTestJSON(w, flink.MockTaskManagerDetail(r.PathValue("id")))
	})
	mux.HandleFunc("GET /taskmanagers/{id}/metrics", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	_, err := agg.TMDetail(context.Background(), "tm-00000000000000000000000000000001")
	if err == nil {
		t.Fatal("expected error when TM metric endpoint fails")
	}
}

func TestAggregator_JMDetail_Success(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	result, err := agg.JMDetail(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Config) == 0 {
		t.Fatal("expected config entries")
	}
	if result.Environment == nil {
		t.Fatal("expected environment to be non-nil")
	}
	if len(result.Metrics) != 13 {
		t.Errorf("expected 13 JM metrics, got %d", len(result.Metrics))
	}
}

func TestAggregator_JMDetail_PartialFailure(t *testing.T) {
	t.Parallel()

	mux := http.NewServeMux()
	mux.HandleFunc("GET /jobmanager/config", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockJMConfig())
	})
	mux.HandleFunc("GET /jobmanager/environment", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
	})
	mux.HandleFunc("GET /jobmanager/metrics", func(w http.ResponseWriter, _ *http.Request) {
		writeTestJSON(w, flink.MockJMMetrics())
	})

	srv := httptest.NewServer(mux)
	defer srv.Close()

	client := flink.NewClient(flink.WithBaseURL(srv.URL))
	agg := flink.NewAggregator(client)

	_, err := agg.JMDetail(context.Background())
	if err == nil {
		t.Fatal("expected error when JM environment endpoint fails")
	}
}

// writeTestJSON is a test-local JSON writer (can't import the unexported writeJSON from mock.go).
func writeTestJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	data, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(data) //nolint:gosec // test server writing JSON
}
