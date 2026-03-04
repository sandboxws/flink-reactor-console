package flink

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
)

// NewMockServer creates an httptest.Server that returns realistic Flink REST responses.
// Routes match the Flink REST API path structure.
func NewMockServer() *httptest.Server {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /overview", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockClusterOverview())
	})

	mux.HandleFunc("GET /jobs/overview", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockJobsOverview())
	})

	mux.HandleFunc("GET /jobs/{id}", func(w http.ResponseWriter, r *http.Request) {
		jobID := r.PathValue("id")
		writeJSON(w, MockJobDetail(jobID))
	})

	mux.HandleFunc("GET /jobs/{id}/exceptions", func(w http.ResponseWriter, r *http.Request) {
		jobID := r.PathValue("id")
		writeJSON(w, MockJobExceptions(jobID))
	})

	mux.HandleFunc("GET /jobs/{id}/checkpoints", func(w http.ResponseWriter, r *http.Request) {
		jobID := r.PathValue("id")
		writeJSON(w, MockCheckpointStats(jobID))
	})

	mux.HandleFunc("GET /jobs/{id}/checkpoints/config", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockCheckpointConfig())
	})

	mux.HandleFunc("GET /jobs/{id}/config", func(w http.ResponseWriter, r *http.Request) {
		jobID := r.PathValue("id")
		writeJSON(w, MockJobConfig(jobID))
	})

	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/watermarks", func(w http.ResponseWriter, r *http.Request) {
		vid := r.PathValue("vid")
		writeJSON(w, MockWatermarks(vid))
	})

	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/backpressure", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockBackPressure())
	})

	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}/accumulators", func(w http.ResponseWriter, r *http.Request) {
		vid := r.PathValue("vid")
		writeJSON(w, MockAccumulators(vid))
	})

	mux.HandleFunc("GET /jobs/{id}/vertices/{vid}", func(w http.ResponseWriter, r *http.Request) {
		vid := r.PathValue("vid")
		writeJSON(w, MockVertexDetail(vid))
	})

	mux.HandleFunc("GET /taskmanagers", func(w http.ResponseWriter, r *http.Request) {
		// Only match the exact path, not subpaths.
		if r.URL.Path != "/taskmanagers" {
			http.NotFound(w, r)
			return
		}
		writeJSON(w, MockTaskManagers())
	})

	mux.HandleFunc("GET /taskmanagers/{id}/metrics", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockTMMetrics())
	})

	mux.HandleFunc("GET /taskmanagers/{id}", func(w http.ResponseWriter, r *http.Request) {
		tmID := r.PathValue("id")
		writeJSON(w, MockTaskManagerDetail(tmID))
	})

	mux.HandleFunc("GET /jobmanager/config", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockJMConfig())
	})

	mux.HandleFunc("GET /jobmanager/environment", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockJMEnvironment())
	})

	mux.HandleFunc("GET /jobmanager/metrics", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockJMMetrics())
	})

	mux.HandleFunc("GET /config", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockClusterConfig())
	})

	mux.HandleFunc("GET /jars", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, MockJarList())
	})

	mux.HandleFunc("POST /jars/upload", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, JarUploadResponse{
			Filename: "/tmp/flink-web-upload/uploaded.jar",
			Status:   "success",
		})
	})

	mux.HandleFunc("DELETE /jars/{id}", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	// Catch-all for unmatched paths.
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if !isKnownPrefix(r.URL.Path) {
			http.NotFound(w, r)
			return
		}
		http.NotFound(w, r)
	})

	return httptest.NewServer(mux)
}

func writeJSON(w http.ResponseWriter, v any) {
	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(v); err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
	}
}

func isKnownPrefix(path string) bool {
	prefixes := []string{"/overview", "/jobs", "/taskmanagers", "/jobmanager", "/jars"}
	for _, p := range prefixes {
		if strings.HasPrefix(path, p) {
			return true
		}
	}
	return false
}
