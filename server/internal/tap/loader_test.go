package tap_test

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/tap"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func TestLoader_InitialLoad(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeManifest(t, dir, "metrics.json", `{"name":"metrics","description":"Metrics tap","version":"1.0.0","config":{}}`)
	writeManifest(t, dir, "logs.json", `{"name":"logs","description":"Log tap","version":"2.0.0","config":{"level":"info"}}`)

	loader := tap.NewLoader(dir, time.Hour, testLogger())
	if err := loader.Reload(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	manifests := loader.Manifests()
	if len(manifests) != 2 {
		t.Fatalf("expected 2 manifests, got %d", len(manifests))
	}
}

func TestLoader_EmptyDirectory(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	loader := tap.NewLoader(dir, time.Hour, testLogger())

	if err := loader.Reload(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	manifests := loader.Manifests()
	if len(manifests) != 0 {
		t.Errorf("expected 0 manifests, got %d", len(manifests))
	}
}

func TestLoader_MissingDirectory(t *testing.T) {
	t.Parallel()

	loader := tap.NewLoader("/nonexistent/path", time.Hour, testLogger())

	if err := loader.Reload(); err != nil {
		t.Fatalf("expected nil error for missing directory, got: %v", err)
	}

	manifests := loader.Manifests()
	if manifests != nil {
		t.Errorf("expected nil manifests for missing directory, got %d", len(manifests))
	}
}

func TestLoader_InvalidJSONSkipped(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeManifest(t, dir, "valid.json", `{"name":"valid","description":"Valid","version":"1.0.0","config":{}}`)
	writeManifest(t, dir, "invalid.json", `{not valid json}`)
	writeManifest(t, dir, "also-valid.json", `{"name":"also-valid","description":"Also valid","version":"1.0.0","config":{}}`)

	loader := tap.NewLoader(dir, time.Hour, testLogger())
	if err := loader.Reload(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	manifests := loader.Manifests()
	if len(manifests) != 2 {
		t.Errorf("expected 2 valid manifests (invalid skipped), got %d", len(manifests))
	}
}

func TestLoader_NonJSONFilesIgnored(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeManifest(t, dir, "manifest.json", `{"name":"test","description":"Test","version":"1.0.0","config":{}}`)
	writeManifest(t, dir, "readme.txt", `This is not a manifest`)
	writeManifest(t, dir, "data.yaml", `name: test`)

	loader := tap.NewLoader(dir, time.Hour, testLogger())
	if err := loader.Reload(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	manifests := loader.Manifests()
	if len(manifests) != 1 {
		t.Errorf("expected 1 manifest (non-JSON ignored), got %d", len(manifests))
	}
}

func TestLoader_PollingDetectsNewFiles(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeManifest(t, dir, "initial.json", `{"name":"initial","description":"Initial","version":"1.0.0","config":{}}`)

	loader := tap.NewLoader(dir, 50*time.Millisecond, testLogger())
	loader.Start(context.Background())
	defer loader.Stop()

	// Wait for initial load.
	time.Sleep(100 * time.Millisecond)

	manifests := loader.Manifests()
	if len(manifests) != 1 {
		t.Fatalf("expected 1 manifest after initial load, got %d", len(manifests))
	}

	// Add a new file and wait for polling to pick it up.
	writeManifest(t, dir, "added.json", `{"name":"added","description":"Added","version":"1.0.0","config":{}}`)

	// Wait for at least one poll cycle.
	time.Sleep(200 * time.Millisecond)

	manifests = loader.Manifests()
	if len(manifests) != 2 {
		t.Errorf("expected 2 manifests after polling, got %d", len(manifests))
	}
}

func TestLoader_StopCancelsPolling(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	loader := tap.NewLoader(dir, 10*time.Millisecond, testLogger())
	loader.Start(context.Background())
	loader.Stop()

	// Should not panic or hang after stop.
	time.Sleep(50 * time.Millisecond)
}

func TestLoader_ManifestsReturnsCopy(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	writeManifest(t, dir, "test.json", `{"name":"test","description":"Test","version":"1.0.0","config":{}}`)

	loader := tap.NewLoader(dir, time.Hour, testLogger())
	if err := loader.Reload(); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	m1 := loader.Manifests()
	m2 := loader.Manifests()

	// Modifying one copy should not affect the other.
	if len(m1) > 0 {
		m1[0].Name = "modified"
	}
	if m2[0].Name == "modified" {
		t.Error("expected Manifests() to return a copy, but modification leaked")
	}
}

func writeManifest(t *testing.T, dir, name, content string) {
	t.Helper()
	if err := os.WriteFile(filepath.Join(dir, name), []byte(content), 0o600); err != nil {
		t.Fatalf("failed to write manifest: %v", err)
	}
}
