package sqlgateway_test

import (
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/sqlgateway"
)

func TestProxy_RequestForwarding(t *testing.T) {
	t.Parallel()

	// Backend that echoes the request path.
	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/plain")
		_, _ = w.Write([]byte(r.URL.Path)) //nolint:gosec // test server echoing path
	}))
	defer backend.Close()

	proxy, err := sqlgateway.NewProxy(backend.URL, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql-gateway/v1/sessions", nil)
	proxy.Handler().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected 200, got %d", rec.Code)
	}

	body := rec.Body.String()
	if body != "/v1/sessions" {
		t.Errorf("expected path /v1/sessions, got %s", body)
	}
}

func TestProxy_PathStripping(t *testing.T) {
	t.Parallel()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = w.Write([]byte(r.URL.Path)) //nolint:gosec // test server echoing path
	}))
	defer backend.Close()

	proxy, err := sqlgateway.NewProxy(backend.URL, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	tests := []struct {
		input    string
		expected string
	}{
		{"/api/sql-gateway/v1/sessions", "/v1/sessions"},
		{"/api/sql-gateway/v1/sessions/abc/operations/def", "/v1/sessions/abc/operations/def"},
		{"/api/sql-gateway/", "/"},
		{"/api/sql-gateway", "/"},
	}

	for _, tt := range tests {
		rec := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, tt.input, nil)
		proxy.Handler().ServeHTTP(rec, req)

		body := rec.Body.String()
		if body != tt.expected {
			t.Errorf("input %s: expected path %s, got %s", tt.input, tt.expected, body)
		}
	}
}

func TestProxy_AuthInjection(t *testing.T) {
	t.Parallel()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		_, _ = w.Write([]byte(auth)) //nolint:gosec // test server echoing header
	}))
	defer backend.Close()

	proxy, err := sqlgateway.NewProxy(backend.URL, "Bearer test-token-123")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql-gateway/v1/sessions", nil)
	proxy.Handler().ServeHTTP(rec, req)

	body := rec.Body.String()
	if body != "Bearer test-token-123" {
		t.Errorf("expected auth header 'Bearer test-token-123', got '%s'", body)
	}
}

func TestProxy_NoAuth(t *testing.T) {
	t.Parallel()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth := r.Header.Get("Authorization")
		_, _ = w.Write([]byte(auth)) //nolint:gosec // test server echoing header
	}))
	defer backend.Close()

	proxy, err := sqlgateway.NewProxy(backend.URL, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql-gateway/v1/sessions", nil)
	proxy.Handler().ServeHTTP(rec, req)

	body := rec.Body.String()
	if body != "" {
		t.Errorf("expected empty auth header, got '%s'", body)
	}
}

func TestProxy_RequestBodyForwarded(t *testing.T) {
	t.Parallel()

	backend := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		data, _ := io.ReadAll(r.Body)
		_, _ = w.Write(data)
	}))
	defer backend.Close()

	proxy, err := sqlgateway.NewProxy(backend.URL, "")
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	reqBody := `{"statement":"SELECT 1"}`
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPost, "/api/sql-gateway/v1/sessions/abc/statements", strings.NewReader(reqBody))
	req.Header.Set("Content-Type", "application/json")
	proxy.Handler().ServeHTTP(rec, req)

	body := rec.Body.String()
	if body != reqBody {
		t.Errorf("expected body %s, got %s", reqBody, body)
	}
}

func TestProxy_InvalidURL(t *testing.T) {
	t.Parallel()

	_, err := sqlgateway.NewProxy("://invalid", "")
	if err == nil {
		t.Fatal("expected error for invalid URL")
	}
}
