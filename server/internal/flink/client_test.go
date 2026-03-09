package flink

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

// ---------------------------------------------------------------------------
// 4.1 Auth header injection tests
// ---------------------------------------------------------------------------

func TestAuthHeaderInjection(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name       string
		opts       []ClientOption
		wantHeader string
	}{
		{
			name:       "no auth",
			opts:       nil,
			wantHeader: "",
		},
		{
			name:       "basic auth",
			opts:       []ClientOption{WithBasicAuth("admin", "secret")},
			wantHeader: "Basic YWRtaW46c2VjcmV0", // base64("admin:secret")
		},
		{
			name:       "bearer auth",
			opts:       []ClientOption{WithBearerAuth("my-token")},
			wantHeader: "Bearer my-token",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			var gotHeader string

			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
				gotHeader = w.Header().Get("X-Got-Auth") // won't be set; capture from request below
			}))
			defer srv.Close()

			// Re-create with a handler that captures the auth header from request.
			srv.Close()
			srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				gotHeader = r.Header.Get("Authorization")
				w.Header().Set("Content-Type", "application/json")
				_, _ = fmt.Fprint(w, `{"flink-version":"1.20.0"}`)
			}))
			defer srv.Close()

			opts := append([]ClientOption{WithBaseURL(srv.URL)}, tt.opts...)
			client := NewClient(opts...)

			var result ClusterOverview
			err := client.GetJSON(context.Background(), "/overview", &result)
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}

			if gotHeader != tt.wantHeader {
				t.Errorf("Authorization header = %q, want %q", gotHeader, tt.wantHeader)
			}
		})
	}
}

// ---------------------------------------------------------------------------
// 4.2 Response parsing tests
// ---------------------------------------------------------------------------

func TestGetJSON_ClusterOverview(t *testing.T) {
	t.Parallel()

	srv := NewMockServer()
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result ClusterOverview
	err := client.GetJSON(context.Background(), "/overview", &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.FlinkVersion != "1.20.0" {
		t.Errorf("FlinkVersion = %q, want %q", result.FlinkVersion, "1.20.0")
	}
	if result.SlotsTotal != 16 {
		t.Errorf("SlotsTotal = %d, want %d", result.SlotsTotal, 16)
	}
	if result.TaskManagers != 4 {
		t.Errorf("TaskManagers = %d, want %d", result.TaskManagers, 4)
	}
}

func TestGetJSON_JobsOverview(t *testing.T) {
	t.Parallel()

	srv := NewMockServer()
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result JobsOverview
	err := client.GetJSON(context.Background(), "/jobs/overview", &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(result.Jobs) == 0 {
		t.Fatal("expected at least one job")
	}

	// Verify multiple states are present.
	states := make(map[string]bool)
	for _, j := range result.Jobs {
		states[j.State] = true
	}
	for _, want := range []string{"RUNNING", "FINISHED", "CANCELED"} {
		if !states[want] {
			t.Errorf("expected job in state %q", want)
		}
	}
}

func TestGetJSON_JobDetail(t *testing.T) {
	t.Parallel()

	srv := NewMockServer()
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	jobID := "d1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6"
	var result JobDetail
	err := client.GetJSON(context.Background(), "/jobs/"+jobID, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if result.JID != jobID {
		t.Errorf("JID = %q, want %q", result.JID, jobID)
	}
	if result.State != "RUNNING" {
		t.Errorf("State = %q, want %q", result.State, "RUNNING")
	}
	if len(result.Vertices) == 0 {
		t.Error("expected at least one vertex")
	}
	if len(result.Plan.Nodes) == 0 {
		t.Error("expected at least one plan node")
	}
}

// ---------------------------------------------------------------------------
// 4.3 Error handling tests
// ---------------------------------------------------------------------------

func TestAPIError_NonJSON(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusBadGateway)
		_, _ = fmt.Fprint(w, "<html>Bad Gateway</html>")
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result ClusterOverview
	err := client.GetJSON(context.Background(), "/overview", &result)
	if err == nil {
		t.Fatal("expected error")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}

	if apiErr.StatusCode != http.StatusBadGateway {
		t.Errorf("StatusCode = %d, want %d", apiErr.StatusCode, http.StatusBadGateway)
	}
	if len(apiErr.Errors) != 0 {
		t.Errorf("expected empty Errors slice for non-JSON body, got %d entries", len(apiErr.Errors))
	}
}

func TestAPIError_WithFlinkBody(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		body := map[string]any{
			"errors": []map[string]any{
				{"message": "Job not found", "root-cause": []string{"java.lang.RuntimeException"}},
			},
		}
		_ = json.NewEncoder(w).Encode(body)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result JobDetail
	err := client.GetJSON(context.Background(), "/jobs/unknown", &result)
	if err == nil {
		t.Fatal("expected error")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}

	if apiErr.StatusCode != http.StatusInternalServerError {
		t.Errorf("StatusCode = %d, want %d", apiErr.StatusCode, http.StatusInternalServerError)
	}
	if len(apiErr.Errors) != 1 {
		t.Fatalf("expected 1 error entry, got %d", len(apiErr.Errors))
	}
	if apiErr.Errors[0].Message != "Job not found" {
		t.Errorf("error message = %q, want %q", apiErr.Errors[0].Message, "Job not found")
	}
}

func TestAPIError_4xx(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = fmt.Fprint(w, `{"errors":[{"message":"Not Found"}]}`)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result ClusterOverview
	err := client.GetJSON(context.Background(), "/unknown", &result)

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}
	if apiErr.StatusCode != 404 {
		t.Errorf("StatusCode = %d, want 404", apiErr.StatusCode)
	}
}

func TestAPIError_SQLGatewayStackTrace(t *testing.T) {
	t.Parallel()

	// Flink REST returns non-RestHandlerException errors as two entries:
	// ["Internal server error.", "<full stack trace with Caused by lines>"]
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusInternalServerError)
		body := map[string]any{
			"errors": []string{
				"Internal server error.",
				"org.apache.flink.table.gateway.service.utils.SqlExecutionException: Failed to execute the operation abc.\n\tat org.apache.flink.Foo.bar(Foo.java:42)\nCaused by: org.apache.flink.table.api.TableException: Sort on a non-time-attribute field is not supported.\n\tat org.apache.flink.Baz.qux(Baz.java:99)",
			},
		}
		_ = json.NewEncoder(w).Encode(body)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result map[string]any
	err := client.GetJSON(context.Background(), "/v3/sessions/s1/operations/o1/result/0", &result)
	if err == nil {
		t.Fatal("expected error")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}

	// Error() should extract the root cause, not "Internal server error."
	errMsg := apiErr.Error()
	if !strings.Contains(errMsg, "Sort on a non-time-attribute field is not supported") {
		t.Errorf("expected root cause in error message, got: %s", errMsg)
	}
	if strings.Contains(errMsg, "Internal server error") {
		t.Errorf("error message should not contain generic message, got: %s", errMsg)
	}
}

// ---------------------------------------------------------------------------
// 4.4 Timeout enforcement tests
// ---------------------------------------------------------------------------

func TestGetJSON_Timeout(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		// Simulate a slow server — sleep longer than the caller's context timeout.
		time.Sleep(2 * time.Second)
		_, _ = fmt.Fprint(w, `{"flink-version":"1.20.0"}`)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	// Create a context with a timeout shorter than the server delay.
	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	var result ClusterOverview
	err := client.GetJSON(ctx, "/overview", &result)
	if err == nil {
		t.Fatal("expected timeout error")
	}

	var timeoutErr *TimeoutError
	if !errors.As(err, &timeoutErr) {
		// Connection error wrapping a context timeout is also acceptable.
		var connErr *ConnectionError
		if errors.As(err, &connErr) {
			return
		}
		t.Fatalf("expected TimeoutError or ConnectionError, got %T: %v", err, err)
	}
}

// ---------------------------------------------------------------------------
// 4.5 GetText tests
// ---------------------------------------------------------------------------

func TestGetText(t *testing.T) {
	t.Parallel()

	var gotAccept string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotAccept = r.Header.Get("Accept")
		w.Header().Set("Content-Type", "text/plain")
		_, _ = fmt.Fprint(w, "log line 1\nlog line 2\n")
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	text, err := client.GetText(context.Background(), "/jobmanager/stdout")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotAccept != "text/plain" {
		t.Errorf("Accept header = %q, want %q", gotAccept, "text/plain")
	}
	if text != "log line 1\nlog line 2\n" {
		t.Errorf("response body = %q, want %q", text, "log line 1\nlog line 2\n")
	}
}

func TestGetText_Error(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = fmt.Fprint(w, "not found")
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	_, err := client.GetText(context.Background(), "/unknown")
	if err == nil {
		t.Fatal("expected error")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}
	if apiErr.StatusCode != 404 {
		t.Errorf("StatusCode = %d, want 404", apiErr.StatusCode)
	}
}

// ---------------------------------------------------------------------------
// 4.6 PostJSON tests
// ---------------------------------------------------------------------------

func TestPostJSON(t *testing.T) {
	t.Parallel()

	var gotContentType string
	var gotBody map[string]any

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotContentType = r.Header.Get("Content-Type")
		if err := json.NewDecoder(r.Body).Decode(&gotBody); err != nil {
			t.Errorf("failed to decode request body: %v", err)
		}

		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"jobid":"abc123"}`)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	reqBody := map[string]any{"programArgs": "--input kafka"}
	var result JarRunResponse
	err := client.PostJSON(context.Background(), "/jars/abc/run", reqBody, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotContentType != "application/json" {
		t.Errorf("Content-Type = %q, want %q", gotContentType, "application/json")
	}
	if result.JobID != "abc123" {
		t.Errorf("JobID = %q, want %q", result.JobID, "abc123")
	}
}

func TestPostJSON_NilBody(t *testing.T) {
	t.Parallel()

	var gotContentType string

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotContentType = r.Header.Get("Content-Type")
		w.Header().Set("Content-Type", "application/json")
		_, _ = fmt.Fprint(w, `{"jobid":"xyz"}`)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result JarRunResponse
	err := client.PostJSON(context.Background(), "/path", nil, &result)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if gotContentType != "application/json" {
		t.Errorf("Content-Type = %q, want %q", gotContentType, "application/json")
	}
}

// ---------------------------------------------------------------------------
// 4.7 Delete tests
// ---------------------------------------------------------------------------

func TestDelete_Success(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodDelete {
			t.Errorf("Method = %q, want %q", r.Method, http.MethodDelete)
		}
		w.WriteHeader(http.StatusOK)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	err := client.Delete(context.Background(), "/jars/abc")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestDelete_Error(t *testing.T) {
	t.Parallel()

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusNotFound)
		_, _ = fmt.Fprint(w, `{"errors":[{"message":"JAR not found"}]}`)
	}))
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	err := client.Delete(context.Background(), "/jars/nonexistent")
	if err == nil {
		t.Fatal("expected error")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}
	if apiErr.StatusCode != 404 {
		t.Errorf("StatusCode = %d, want 404", apiErr.StatusCode)
	}
}

// ---------------------------------------------------------------------------
// 4.8 Connection error classification tests
// ---------------------------------------------------------------------------

func TestConnectionError_Unreachable(t *testing.T) {
	t.Parallel()

	// Use a URL that won't have anything listening.
	client := NewClient(WithBaseURL("http://127.0.0.1:1"))

	var result ClusterOverview
	err := client.GetJSON(context.Background(), "/overview", &result)
	if err == nil {
		t.Fatal("expected connection error")
	}

	var connErr *ConnectionError
	var timeoutErr *TimeoutError
	if !errors.As(err, &connErr) && !errors.As(err, &timeoutErr) {
		t.Fatalf("expected ConnectionError or TimeoutError, got %T: %v", err, err)
	}
}

// ---------------------------------------------------------------------------
// Mock server 404 test
// ---------------------------------------------------------------------------

func TestMockServer_UnknownPath(t *testing.T) {
	t.Parallel()

	srv := NewMockServer()
	defer srv.Close()

	client := NewClient(WithBaseURL(srv.URL))

	var result map[string]any
	err := client.GetJSON(context.Background(), "/nonexistent/path", &result)
	if err == nil {
		t.Fatal("expected error for unknown path")
	}

	var apiErr *APIError
	if !errors.As(err, &apiErr) {
		t.Fatalf("expected APIError, got %T: %v", err, err)
	}
	if apiErr.StatusCode != 404 {
		t.Errorf("StatusCode = %d, want 404", apiErr.StatusCode)
	}
}

// ---------------------------------------------------------------------------
// Default client options test
// ---------------------------------------------------------------------------

func TestNewClient_Defaults(t *testing.T) {
	t.Parallel()

	client := NewClient()

	if client.baseURL != "http://localhost:8081" {
		t.Errorf("baseURL = %q, want %q", client.baseURL, "http://localhost:8081")
	}
	if client.authHeader != "" {
		t.Errorf("authHeader = %q, want empty", client.authHeader)
	}
	if client.httpClient != http.DefaultClient {
		t.Error("expected http.DefaultClient")
	}
}
