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

func TestHealthz(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)
	s := server.New(":0", logger, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.Echo().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	ct := rec.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode JSON: %v", err)
	}
	if body["status"] != "ok" {
		t.Errorf("expected status 'ok', got %q", body["status"])
	}
}

func TestReadyz(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)
	s := server.New(":0", logger, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/readyz", nil)
	rec := httptest.NewRecorder()
	s.Echo().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Errorf("expected status 200, got %d", rec.Code)
	}

	ct := rec.Header().Get("Content-Type")
	if ct != "application/json" {
		t.Errorf("expected Content-Type application/json, got %q", ct)
	}

	var body map[string]string
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("failed to decode JSON: %v", err)
	}
	if body["status"] != "ready" {
		t.Errorf("expected status 'ready', got %q", body["status"])
	}
}

func TestRequestID_Generated(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)
	s := server.New(":0", logger, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	rec := httptest.NewRecorder()
	s.Echo().ServeHTTP(rec, req)

	id := rec.Header().Get("X-Request-Id")
	if id == "" {
		t.Error("expected X-Request-Id header to be set")
	}
}

func TestRequestID_Passthrough(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)
	s := server.New(":0", logger, nil, nil, nil)

	req := httptest.NewRequest(http.MethodGet, "/healthz", nil)
	req.Header.Set("X-Request-Id", "abc-123")
	rec := httptest.NewRecorder()
	s.Echo().ServeHTTP(rec, req)

	id := rec.Header().Get("X-Request-Id")
	if id != "abc-123" {
		t.Errorf("expected X-Request-Id 'abc-123', got %q", id)
	}
}

func TestCORS_Preflight(t *testing.T) {
	var logBuf bytes.Buffer
	logger := observability.NewTestLogger(&logBuf, 0)
	s := server.New(":0", logger, nil, nil, nil)

	req := httptest.NewRequest(http.MethodOptions, "/graphql", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	req.Header.Set("Access-Control-Request-Method", "POST")
	rec := httptest.NewRecorder()
	s.Echo().ServeHTTP(rec, req)

	if rec.Code != http.StatusNoContent {
		t.Errorf("expected status 204, got %d", rec.Code)
	}
	if v := rec.Header().Get("Access-Control-Allow-Origin"); v != "*" {
		t.Errorf("expected Allow-Origin '*', got %q", v)
	}
	if v := rec.Header().Get("Access-Control-Allow-Methods"); v == "" {
		t.Error("expected Access-Control-Allow-Methods header")
	}
}
