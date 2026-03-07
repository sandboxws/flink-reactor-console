package spa_test

import (
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/labstack/echo/v4"
	"github.com/sandboxws/flink-reactor/apps/server/internal/spa"
)

func setupTestDir(t *testing.T) string {
	t.Helper()
	dir := t.TempDir()

	// Create index.html.
	if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte("<html>SPA</html>"), 0o600); err != nil {
		t.Fatal(err)
	}

	// Create assets/index-abc123.js (Vite hashed asset).
	assetsDir := filepath.Join(dir, "assets")
	if err := os.MkdirAll(assetsDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(assetsDir, "index-abc123.js"), []byte("console.log('hi')"), 0o600); err != nil {
		t.Fatal(err)
	}

	// Create _next/static/chunks/main.js (legacy Next.js hashed asset).
	nextDir := filepath.Join(dir, "_next", "static", "chunks")
	if err := os.MkdirAll(nextDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(nextDir, "main.js"), []byte("console.log('hi')"), 0o600); err != nil {
		t.Fatal(err)
	}

	// Create a regular static file.
	if err := os.WriteFile(filepath.Join(dir, "favicon.ico"), []byte("icon"), 0o600); err != nil {
		t.Fatal(err)
	}

	return dir
}

func setupEcho(dir string) *echo.Echo {
	e := echo.New()
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

	// Register a mock API route to verify SPA doesn't intercept API paths.
	e.GET("/graphql", func(c echo.Context) error {
		return c.String(http.StatusOK, "graphql")
	})
	e.GET("/healthz", func(c echo.Context) error {
		return c.String(http.StatusOK, "ok")
	})
	e.GET("/api/logs/jobmanager", func(c echo.Context) error {
		return c.String(http.StatusOK, "logs")
	})

	spa.Register(e, spa.Config{StaticDir: dir}, logger)
	return e
}

func TestSPA_ServesStaticFile(t *testing.T) {
	t.Parallel()
	dir := setupTestDir(t)
	e := setupEcho(dir)

	req := httptest.NewRequest(http.MethodGet, "/favicon.ico", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if rec.Body.String() != "icon" {
		t.Fatalf("expected 'icon', got %q", rec.Body.String())
	}
}

func TestSPA_ViteAssetCacheHeaders(t *testing.T) {
	t.Parallel()
	dir := setupTestDir(t)
	e := setupEcho(dir)

	req := httptest.NewRequest(http.MethodGet, "/assets/index-abc123.js", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	cc := rec.Header().Get("Cache-Control")
	if cc != "public, max-age=31536000, immutable" {
		t.Fatalf("expected immutable cache header for Vite assets, got %q", cc)
	}
}

func TestSPA_LegacyNextAssetCacheHeaders(t *testing.T) {
	t.Parallel()
	dir := setupTestDir(t)
	e := setupEcho(dir)

	req := httptest.NewRequest(http.MethodGet, "/_next/static/chunks/main.js", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	cc := rec.Header().Get("Cache-Control")
	if cc != "public, max-age=31536000, immutable" {
		t.Fatalf("expected immutable cache header, got %q", cc)
	}
}

func TestSPA_FallbackToIndex(t *testing.T) {
	t.Parallel()
	dir := setupTestDir(t)
	e := setupEcho(dir)

	// Request a client-side route that doesn't exist as a file.
	req := httptest.NewRequest(http.MethodGet, "/jobs/abc123", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}
	if rec.Body.String() != "<html>SPA</html>" {
		t.Fatalf("expected index.html content, got %q", rec.Body.String())
	}
	cc := rec.Header().Get("Cache-Control")
	if cc != "no-cache" {
		t.Fatalf("expected no-cache for SPA fallback, got %q", cc)
	}
}

func TestSPA_APIRouteTakesPrecedence(t *testing.T) {
	t.Parallel()
	dir := setupTestDir(t)
	e := setupEcho(dir)

	tests := []struct {
		path   string
		expect string
	}{
		{"/graphql", "graphql"},
		{"/healthz", "ok"},
		{"/api/logs/jobmanager", "logs"},
	}

	for _, tt := range tests {
		req := httptest.NewRequest(http.MethodGet, tt.path, nil)
		rec := httptest.NewRecorder()
		e.ServeHTTP(rec, req)

		if rec.Code != http.StatusOK {
			t.Fatalf("%s: expected 200, got %d", tt.path, rec.Code)
		}
		if rec.Body.String() != tt.expect {
			t.Fatalf("%s: expected %q, got %q", tt.path, tt.expect, rec.Body.String())
		}
	}
}

func TestSPA_NonExistentDir_DoesNotPanic(t *testing.T) {
	t.Parallel()
	e := echo.New()
	logger := slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelError}))

	// Should not panic even with non-existent directory.
	spa.Register(e, spa.Config{StaticDir: "/nonexistent/path"}, logger)

	req := httptest.NewRequest(http.MethodGet, "/anything", nil)
	rec := httptest.NewRecorder()
	e.ServeHTTP(rec, req)

	// Should get a 404 or similar — not a panic.
	if rec.Code == 0 {
		t.Fatal("expected a response status code")
	}
}
