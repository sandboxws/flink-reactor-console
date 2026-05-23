package graphql_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql"
)

func writeJobsTestJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	data, err := json.Marshal(v)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	_, _ = w.Write(data) //nolint:gosec // test server writing JSON
}

// jobsRatesMock spins up an httptest server that returns realistic data for
// the jobs list + per-vertex rate + watermark endpoints, so the Jobs resolver
// has something to aggregate.
func jobsRatesMock(t *testing.T, ratesFailJobID string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()

	mux.HandleFunc("GET /jobs/overview", func(w http.ResponseWriter, _ *http.Request) {
		writeJobsTestJSON(w, flink.MockJobsOverview())
	})
	mux.HandleFunc("GET /jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if id == ratesFailJobID {
			w.WriteHeader(http.StatusInternalServerError)
			return
		}
		writeJobsTestJSON(w, flink.MockJobDetail(id))
	})
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/subtasks/metrics", func(w http.ResponseWriter, _ *http.Request) {
		writeJobsTestJSON(w, []flink.AggregatedSubtaskMetric{
			{ID: "numRecordsInPerSecond", Sum: 100},
			{ID: "numRecordsOutPerSecond", Sum: 90},
		})
	})
	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/watermarks", func(w http.ResponseWriter, _ *http.Request) {
		writeJobsTestJSON(w, []flink.WatermarkEntry{
			{ID: "0.currentInputWatermark", Value: "1709251200000"},
		})
	})

	return httptest.NewServer(mux)
}

func setupResolverWithMock(t *testing.T, srv *httptest.Server) *graphql.Resolver {
	t.Helper()
	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "default", URL: srv.URL, Default: true},
	}, testLogger()); err != nil {
		t.Fatalf("cluster manager init: %v", err)
	}
	return &graphql.Resolver{Manager: mgr}
}

func TestJobs_PopulatesRateFieldsForRunningJobs(t *testing.T) {
	t.Parallel()
	srv := jobsRatesMock(t, "")
	defer srv.Close()

	resolver := setupResolverWithMock(t, srv)

	jobs, err := queryResolver(resolver).Jobs(context.Background(), nil)
	if err != nil {
		t.Fatalf("Jobs() error: %v", err)
	}

	var running, nonRunning int
	for _, j := range jobs {
		if j.State == "RUNNING" {
			running++
			if j.RecordsInPerSecond == nil {
				t.Errorf("RUNNING job %s has nil RecordsInPerSecond", j.ID)
			}
			if j.RecordsOutPerSecond == nil {
				t.Errorf("RUNNING job %s has nil RecordsOutPerSecond", j.ID)
			}
			if j.WatermarkLag == nil {
				t.Errorf("RUNNING job %s has nil WatermarkLag", j.ID)
			}
		} else {
			nonRunning++
			if j.RecordsInPerSecond != nil {
				t.Errorf("non-RUNNING job %s (state %s) unexpectedly has RecordsInPerSecond=%v",
					j.ID, j.State, *j.RecordsInPerSecond)
			}
			if j.RecordsOutPerSecond != nil {
				t.Errorf("non-RUNNING job %s (state %s) unexpectedly has RecordsOutPerSecond", j.ID, j.State)
			}
			if j.WatermarkLag != nil {
				t.Errorf("non-RUNNING job %s (state %s) unexpectedly has WatermarkLag", j.ID, j.State)
			}
		}
	}
	if running == 0 {
		t.Fatal("expected at least one RUNNING job in mock data")
	}
	if nonRunning == 0 {
		t.Fatal("expected at least one non-RUNNING job in mock data")
	}
}

func TestJobs_PerJobErrorLeavesOtherRatesIntact(t *testing.T) {
	t.Parallel()

	// MockJobsOverview's first RUNNING job — its rate fetch will fail.
	const failingID = "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"

	srv := jobsRatesMock(t, failingID)
	defer srv.Close()

	resolver := setupResolverWithMock(t, srv)

	jobs, err := queryResolver(resolver).Jobs(context.Background(), nil)
	if err != nil {
		t.Fatalf("Jobs() should not fail when a single job's rate fetch errors: %v", err)
	}

	otherRunningHasRates := false
	for _, j := range jobs {
		if j.ID == failingID {
			if j.RecordsInPerSecond != nil || j.RecordsOutPerSecond != nil || j.WatermarkLag != nil {
				t.Errorf("failing job %s should have nil rate fields, got rin=%v rout=%v lag=%v",
					j.ID, j.RecordsInPerSecond, j.RecordsOutPerSecond, j.WatermarkLag)
			}
			continue
		}
		if j.State == "RUNNING" && j.RecordsInPerSecond != nil {
			otherRunningHasRates = true
		}
	}
	if !otherRunningHasRates {
		t.Error("expected at least one other RUNNING job to still have populated rates")
	}
}
