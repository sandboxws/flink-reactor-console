// Package tap provides a manifest directory scanner for Tap extensions.
package tap

import (
	"context"
	"encoding/json"
	"log/slog"
	"os"
	"path/filepath"
	"sync"
	"time"
)

// Manifest represents a single tap manifest loaded from a JSON file.
type Manifest struct {
	Name        string          `json:"name"`
	Description string          `json:"description"`
	Version     string          `json:"version"`
	Config      json.RawMessage `json:"config"`
}

// Loader scans a directory for JSON manifest files and provides
// thread-safe access to the loaded manifests. It supports background
// polling at a configurable interval.
type Loader struct {
	dir       string
	interval  time.Duration
	logger    *slog.Logger
	mu        sync.RWMutex
	manifests []Manifest
	cancel    context.CancelFunc
}

// NewLoader creates a tap manifest loader.
// dir is the directory to scan for .json manifest files.
// interval is the polling interval for background scanning.
func NewLoader(dir string, interval time.Duration, logger *slog.Logger) *Loader {
	return &Loader{
		dir:      dir,
		interval: interval,
		logger:   logger,
	}
}

// Reload scans the manifest directory and updates the loaded manifests.
// Invalid JSON files are logged as warnings and skipped.
// Returns nil if the directory is empty or does not exist.
func (l *Loader) Reload() error {
	entries, err := os.ReadDir(l.dir)
	if err != nil {
		if os.IsNotExist(err) {
			l.mu.Lock()
			l.manifests = nil
			l.mu.Unlock()
			return nil
		}
		return err
	}

	var manifests []Manifest
	for _, entry := range entries {
		if entry.IsDir() || filepath.Ext(entry.Name()) != ".json" {
			continue
		}

		path := filepath.Join(l.dir, entry.Name())
		data, err := os.ReadFile(path) //nolint:gosec // path is constructed from trusted dir + ReadDir entry
		if err != nil {
			l.logger.Warn("failed to read manifest file",
				slog.String("path", path),
				slog.String("error", err.Error()),
			)
			continue
		}

		var m Manifest
		if err := json.Unmarshal(data, &m); err != nil {
			l.logger.Warn("invalid manifest JSON",
				slog.String("path", path),
				slog.String("error", err.Error()),
			)
			continue
		}

		manifests = append(manifests, m)
	}

	l.mu.Lock()
	l.manifests = manifests
	l.mu.Unlock()

	return nil
}

// Start begins background polling for manifest changes.
// The polling stops when the context is cancelled or Stop is called.
func (l *Loader) Start(ctx context.Context) {
	ctx, l.cancel = context.WithCancel(ctx)

	// Initial load.
	if err := l.Reload(); err != nil {
		l.logger.Error("initial manifest load failed",
			slog.String("dir", l.dir),
			slog.String("error", err.Error()),
		)
	}

	go func() {
		ticker := time.NewTicker(l.interval)
		defer ticker.Stop()

		for {
			select {
			case <-ctx.Done():
				return
			case <-ticker.C:
				if err := l.Reload(); err != nil {
					l.logger.Error("manifest reload failed",
						slog.String("dir", l.dir),
						slog.String("error", err.Error()),
					)
				}
			}
		}
	}()
}

// Stop cancels the background polling goroutine.
func (l *Loader) Stop() {
	if l.cancel != nil {
		l.cancel()
	}
}

// Manifests returns a copy of the currently loaded manifests (thread-safe).
func (l *Loader) Manifests() []Manifest {
	l.mu.RLock()
	defer l.mu.RUnlock()

	if l.manifests == nil {
		return nil
	}

	result := make([]Manifest, len(l.manifests))
	copy(result, l.manifests)
	return result
}
