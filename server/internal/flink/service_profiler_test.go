package flink_test

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
)

// TriggerTaskManagerProfiler must POST {duration, mode} to
// /taskmanagers/:id/profiler and return the created instance.
func TestService_TriggerTaskManagerProfiler_PostsBody(t *testing.T) {
	t.Parallel()

	var (
		gotMethod string
		gotPath   string
		body      map[string]any
	)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotMethod, gotPath = r.Method, r.URL.Path
		if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
			t.Errorf("decode body: %v", err)
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"RUNNING","mode":"ALLOC","duration":30,"triggerTime":123,"outputFile":"alloc_123.html"}`))
	}))
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))
	info, err := svc.TriggerTaskManagerProfiler(context.Background(), "tm-1", "ALLOC", 30)
	if err != nil {
		t.Fatalf("TriggerTaskManagerProfiler: %v", err)
	}

	if gotMethod != http.MethodPost {
		t.Errorf("method = %q, want POST", gotMethod)
	}
	if gotPath != "/taskmanagers/tm-1/profiler" {
		t.Errorf("path = %q, want /taskmanagers/tm-1/profiler", gotPath)
	}
	if body["duration"] != float64(30) {
		t.Errorf("duration = %v, want 30", body["duration"])
	}
	if body["mode"] != "ALLOC" {
		t.Errorf("mode = %v, want ALLOC", body["mode"])
	}
	if info.Status != "RUNNING" || info.OutputFile != "alloc_123.html" {
		t.Errorf("info = %+v, want RUNNING with alloc_123.html", info)
	}
}

// TriggerJobManagerProfiler must POST to /jobmanager/profiler.
func TestService_TriggerJobManagerProfiler_PostsBody(t *testing.T) {
	t.Parallel()

	var gotPath string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath = r.URL.Path
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"status":"RUNNING","mode":"CPU","duration":30}`))
	}))
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))
	info, err := svc.TriggerJobManagerProfiler(context.Background(), "CPU", 30)
	if err != nil {
		t.Fatalf("TriggerJobManagerProfiler: %v", err)
	}
	if gotPath != "/jobmanager/profiler" {
		t.Errorf("path = %q, want /jobmanager/profiler", gotPath)
	}
	if info.Mode != "CPU" {
		t.Errorf("mode = %q, want CPU", info.Mode)
	}
}

// The list endpoint must parse a mixed RUNNING/FINISHED/FAILED history from the
// {"profilingList": [...]} envelope.
func TestService_ListTaskManagerProfilerInstances_ParsesStatuses(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet || r.URL.Path != "/taskmanagers/tm-1/profiler" {
			http.Error(w, "unexpected request", http.StatusBadRequest)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{"profilingList":[
			{"status":"RUNNING","mode":"CPU","duration":30,"triggerTime":100},
			{"status":"FINISHED","mode":"ALLOC","duration":60,"finishedTime":200,"outputFile":"alloc_2.html"},
			{"status":"FAILED","mode":"LOCK","duration":10,"message":"could not attach"}
		]}`))
	}))
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))
	list, err := svc.ListTaskManagerProfilerInstances(context.Background(), "tm-1")
	if err != nil {
		t.Fatalf("list: %v", err)
	}
	if len(list) != 3 {
		t.Fatalf("len = %d, want 3", len(list))
	}
	if list[0].Status != "RUNNING" || list[1].Status != "FINISHED" || list[2].Status != "FAILED" {
		t.Errorf("statuses = %q/%q/%q", list[0].Status, list[1].Status, list[2].Status)
	}
	if list[1].OutputFile != "alloc_2.html" {
		t.Errorf("finished outputFile = %q, want alloc_2.html", list[1].OutputFile)
	}
	if list[2].Message != "could not attach" {
		t.Errorf("failed message = %q, want 'could not attach'", list[2].Message)
	}
}

// A 404 on the trigger must be reported as ErrProfilingUnsupported so the UI can
// show a "profiling disabled" state rather than a transport error.
func TestService_TriggerTaskManagerProfiler_404_IsUnsupported(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))
	if _, err := svc.TriggerTaskManagerProfiler(context.Background(), "tm-1", "CPU", 30); !errors.Is(err, flink.ErrProfilingUnsupported) {
		t.Fatalf("err = %v, want ErrProfilingUnsupported", err)
	}
}

// A 404 on listing must degrade to an empty list (feature-detection), not error.
func TestService_ListJobManagerProfilerInstances_404_IsEmpty(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "not found", http.StatusNotFound)
	}))
	defer srv.Close()

	svc := flink.NewService(flink.NewClient(flink.WithBaseURL(srv.URL)))
	list, err := svc.ListJobManagerProfilerInstances(context.Background())
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(list) != 0 {
		t.Errorf("len = %d, want 0", len(list))
	}
}
