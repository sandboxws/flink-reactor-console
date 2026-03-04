package server_test

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/server"
)

func TestRequestID_GeneratesWhenMissing(t *testing.T) {
	handler := server.RequestID(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	id := rec.Header().Get("X-Request-ID")
	if id == "" {
		t.Error("expected X-Request-ID header to be set")
	}
	if len(id) < 32 {
		t.Errorf("expected UUID-length request ID, got %q", id)
	}
}

func TestRequestID_PassesThrough(t *testing.T) {
	handler := server.RequestID(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("X-Request-ID", "abc-123")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	id := rec.Header().Get("X-Request-ID")
	if id != "abc-123" {
		t.Errorf("expected X-Request-ID 'abc-123', got %q", id)
	}
}

func TestRecovery_CatchesPanic(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)

	handler := server.Recovery(logger)(http.HandlerFunc(func(_ http.ResponseWriter, _ *http.Request) {
		panic("test panic")
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusInternalServerError {
		t.Errorf("expected status 500, got %d", rec.Code)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("response is not valid JSON: %v", err)
	}
	if body["error"] != "internal server error" {
		t.Errorf("expected error 'internal server error', got %q", body["error"])
	}

	if logBuf.Len() == 0 {
		t.Error("expected panic to be logged")
	}
}

func TestCORS_Preflight(t *testing.T) {
	handler := server.CORS([]string{"*"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodOptions, "/", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", rec.Code)
	}
	if v := rec.Header().Get("Access-Control-Allow-Origin"); v != "http://localhost:3000" {
		t.Errorf("expected Allow-Origin 'http://localhost:3000', got %q", v)
	}
	if v := rec.Header().Get("Access-Control-Allow-Methods"); v == "" {
		t.Error("expected Access-Control-Allow-Methods header")
	}
	if v := rec.Header().Get("Access-Control-Allow-Headers"); v == "" {
		t.Error("expected Access-Control-Allow-Headers header")
	}
}

func TestCORS_NonPreflight(t *testing.T) {
	called := false
	handler := server.CORS([]string{"*"})(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		called = true
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	if !called {
		t.Error("expected next handler to be called for non-OPTIONS request")
	}
	if v := rec.Header().Get("Access-Control-Allow-Origin"); v != "http://localhost:3000" {
		t.Errorf("expected Allow-Origin header on non-preflight, got %q", v)
	}
}

func TestLogging_LogsRequest(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)

	handler := server.Logging(logger)(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest(http.MethodGet, "/test", nil)
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)

	var entry map[string]any
	if err := json.Unmarshal(logBuf.Bytes(), &entry); err != nil {
		t.Fatalf("log output is not valid JSON: %v\ncontents: %s", err, logBuf.String())
	}

	if entry["method"] != "GET" {
		t.Errorf("expected method GET, got %v", entry["method"])
	}
	if entry["path"] != "/test" {
		t.Errorf("expected path /test, got %v", entry["path"])
	}
}
