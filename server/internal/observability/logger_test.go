package observability_test

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"testing"

	"github.com/flink-reactor/server/internal/observability"
)

func TestNewLogger_StdoutOnly(t *testing.T) {
	logger := observability.NewLogger(slog.LevelInfo, "")
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}
	// Verify it can log without panicking.
	logger.Info("test message", "key", "value")
}

func TestNewLogger_DualOutput(t *testing.T) {
	dir := t.TempDir()
	logFile := filepath.Join(dir, "test.log")

	logger := observability.NewLogger(slog.LevelInfo, logFile)
	if logger == nil {
		t.Fatal("expected non-nil logger")
	}

	logger.Info("dual output test", "key", "value")

	data, err := os.ReadFile(logFile) //nolint:gosec // path from t.TempDir()
	if err != nil {
		t.Fatalf("failed to read log file: %v", err)
	}

	var entry map[string]any
	if err := json.Unmarshal(data, &entry); err != nil {
		t.Fatalf("log file does not contain valid JSON: %v\ncontents: %s", err, data)
	}

	if msg, ok := entry["msg"].(string); !ok || msg != "dual output test" {
		t.Errorf("expected msg 'dual output test', got %v", entry["msg"])
	}
	if v, ok := entry["key"].(string); !ok || v != "value" {
		t.Errorf("expected key 'value', got %v", entry["key"])
	}
}

func TestNewLogger_InvalidLogFile(t *testing.T) {
	// A path that cannot be opened (directory as file).
	logger := observability.NewLogger(slog.LevelInfo, "/dev/null/nonexistent")
	if logger == nil {
		t.Fatal("expected non-nil logger even with invalid file")
	}
	// Should still function (falls back to stdout).
	logger.Info("fallback test")
}

func TestNewTestLogger(t *testing.T) {
	var buf bytes.Buffer
	logger := observability.NewTestLogger(&buf, slog.LevelInfo)

	logger.Info("hello", "component", "test")

	var entry map[string]any
	if err := json.Unmarshal(buf.Bytes(), &entry); err != nil {
		t.Fatalf("output is not valid JSON: %v\ncontents: %s", err, buf.String())
	}

	if msg := entry["msg"]; msg != "hello" {
		t.Errorf("expected msg 'hello', got %v", msg)
	}
	if v := entry["component"]; v != "test" {
		t.Errorf("expected component 'test', got %v", v)
	}
}

func TestMultiHandler_LevelFiltering(t *testing.T) {
	var buf bytes.Buffer
	logger := observability.NewTestLogger(&buf, slog.LevelWarn)

	logger.Info("should not appear")
	if buf.Len() != 0 {
		t.Errorf("expected no output for info-level message at warn threshold, got: %s", buf.String())
	}

	logger.Warn("should appear")
	if buf.Len() == 0 {
		t.Error("expected output for warn-level message at warn threshold")
	}
}
