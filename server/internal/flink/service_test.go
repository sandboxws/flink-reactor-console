package flink_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
)

func TestService_GetClusterOverview(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetClusterOverview(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.FlinkVersion != "1.20.0" {
		t.Errorf("expected Flink version 1.20.0, got %s", result.FlinkVersion)
	}
	if result.SlotsTotal != 16 {
		t.Errorf("expected 16 slots, got %d", result.SlotsTotal)
	}
}

func TestService_GetJobs(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetJobs(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Jobs) != 6 {
		t.Errorf("expected 6 jobs, got %d", len(result.Jobs))
	}
}

func TestService_GetTaskManagers(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetTaskManagers(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.TaskManagers) != 4 {
		t.Errorf("expected 4 TMs, got %d", len(result.TaskManagers))
	}
}

func TestService_GetJars(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetJars(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(result.Files) != 2 {
		t.Errorf("expected 2 JARs, got %d", len(result.Files))
	}
}

func TestService_DeleteJar(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	err := svc.DeleteJar(context.Background(), "test-jar-id")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestService_GetFlinkConfig(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetFlinkConfig(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.FlinkVersion != "1.20.0" {
		t.Errorf("expected Flink version 1.20.0, got %s", result.FlinkVersion)
	}
}

func TestService_GetJobDetail_DelegatesToAggregator(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetJobDetail(context.Background(), "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Job == nil {
		t.Fatal("expected job to be non-nil")
	}
	if len(result.VertexDetails) != 4 {
		t.Errorf("expected 4 vertex details, got %d", len(result.VertexDetails))
	}
}

func TestService_GetTaskManagerDetail_DelegatesToAggregator(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetTaskManagerDetail(context.Background(), "tm-00000000000000000000000000000001")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Detail == nil {
		t.Fatal("expected detail to be non-nil")
	}
	if len(result.Metrics) != 28 {
		t.Errorf("expected 28 metrics, got %d", len(result.Metrics))
	}
}

func TestService_GetJobManager_DelegatesToAggregator(t *testing.T) {
	t.Parallel()
	srv := flink.NewMockServer()
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	result, err := svc.GetJobManager(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if result.Environment == nil {
		t.Fatal("expected environment to be non-nil")
	}
	if len(result.Metrics) != 13 {
		t.Errorf("expected 13 metrics, got %d", len(result.Metrics))
	}
}

func TestService_ErrorPropagation(t *testing.T) {
	t.Parallel()

	// Server returns 500 for everything.
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		_, _ = w.Write([]byte(`{"errors": [{"message": "internal error"}]}`))
	}))
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))

	_, err := svc.GetClusterOverview(context.Background())
	if err == nil {
		t.Fatal("expected error from failing server")
	}

	_, err = svc.GetJobs(context.Background())
	if err == nil {
		t.Fatal("expected error from failing server")
	}

	_, err = svc.GetTaskManagers(context.Background())
	if err == nil {
		t.Fatal("expected error from failing server")
	}
}

// TestService_RunJar_ProgramArgs verifies that RunJar serializes exactly one of
// programArgsList / programArgs onto the wire, driven by which field is set.
// programArgsList is the Flink 2.0+ form; programArgs is the deprecated 1.x
// string. omitempty guarantees the unset field never appears in the payload.
func TestService_RunJar_ProgramArgs(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name          string
		req           *flink.JarRunRequest
		wantHasList   bool
		wantHasString bool
	}{
		{
			name:          "non-empty list sends programArgsList and omits programArgs",
			req:           &flink.JarRunRequest{ProgramArgsList: []string{"--input", "s3://x", "--rate", "10"}},
			wantHasList:   true,
			wantHasString: false,
		},
		{
			name:          "legacy string sends programArgs and omits programArgsList",
			req:           &flink.JarRunRequest{ProgramArgs: "--input s3://x --rate 10"},
			wantHasList:   false,
			wantHasString: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			var (
				gotPath string
				body    map[string]any
			)
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotPath = r.URL.Path
				if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
					t.Errorf("decode request body: %v", err)
				}
				w.Header().Set("Content-Type", "application/json")
				_, _ = w.Write([]byte(`{"jobid":"job-123"}`))
			}))
			defer srv.Close()

			svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))
			resp, err := svc.RunJar(context.Background(), "my-jar", tt.req)
			if err != nil {
				t.Fatalf("RunJar: %v", err)
			}
			if resp.JobID != "job-123" {
				t.Errorf("jobID = %q, want job-123", resp.JobID)
			}
			if gotPath != "/jars/my-jar/run" {
				t.Errorf("path = %q, want /jars/my-jar/run", gotPath)
			}

			if _, has := body["programArgsList"]; has != tt.wantHasList {
				t.Errorf("programArgsList present = %v, want %v (body=%v)", has, tt.wantHasList, body)
			}
			if _, has := body["programArgs"]; has != tt.wantHasString {
				t.Errorf("programArgs present = %v, want %v (body=%v)", has, tt.wantHasString, body)
			}

			// When the list form is used, its elements must round-trip intact.
			if tt.wantHasList {
				raw, ok := body["programArgsList"].([]any)
				if !ok || len(raw) != len(tt.req.ProgramArgsList) {
					t.Fatalf("programArgsList = %v, want %v", body["programArgsList"], tt.req.ProgramArgsList)
				}
				for i, want := range tt.req.ProgramArgsList {
					if raw[i] != want {
						t.Errorf("arg[%d] = %v, want %q", i, raw[i], want)
					}
				}
			}
		})
	}
}
