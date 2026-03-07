// Package observability provides structured logging utilities.
package observability

import (
	"context"
	"io"
	"log/slog"
	"os"
	"time"

	"github.com/lmittmann/tint"
	"github.com/mattn/go-isatty"
)

// newConsoleHandler returns a colorized tint handler when stdout is a TTY,
// otherwise a standard JSON handler for machine consumption.
func newConsoleHandler(level slog.Level) slog.Handler {
	if isatty.IsTerminal(os.Stdout.Fd()) || isatty.IsCygwinTerminal(os.Stdout.Fd()) {
		return tint.NewHandler(os.Stdout, &tint.Options{
			Level:      level,
			TimeFormat: time.Kitchen,
		})
	}
	return slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: level})
}

// NewLogger creates a structured logger.
// Console output is colorized when stdout is a TTY, JSON otherwise.
// If logFile is non-empty, logs are also written to the file in JSON format.
func NewLogger(level slog.Level, logFile string) *slog.Logger {
	consoleHandler := newConsoleHandler(level)

	if logFile == "" {
		return slog.New(consoleHandler)
	}

	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600) //nolint:gosec // log file path from config
	if err != nil {
		// Fall back to stdout-only if file cannot be opened.
		logger := slog.New(consoleHandler)
		logger.Error("failed to open log file, falling back to stdout", "path", logFile, "error", err)
		return logger
	}

	return slog.New(&MultiHandler{
		handlers: []slog.Handler{
			consoleHandler,
			slog.NewJSONHandler(f, &slog.HandlerOptions{Level: level}),
		},
	})
}

// MultiHandler fans out log records to multiple slog.Handlers.
type MultiHandler struct {
	handlers []slog.Handler
}

// Enabled reports whether the handler handles records at the given level.
func (h *MultiHandler) Enabled(ctx context.Context, level slog.Level) bool {
	for _, handler := range h.handlers {
		if handler.Enabled(ctx, level) {
			return true
		}
	}
	return false
}

// Handle sends the record to all enabled handlers.
func (h *MultiHandler) Handle(ctx context.Context, r slog.Record) error {
	for _, handler := range h.handlers {
		if handler.Enabled(ctx, r.Level) {
			if err := handler.Handle(ctx, r); err != nil {
				return err
			}
		}
	}
	return nil
}

// WithAttrs returns a new MultiHandler with the given attributes added to all handlers.
func (h *MultiHandler) WithAttrs(attrs []slog.Attr) slog.Handler {
	handlers := make([]slog.Handler, len(h.handlers))
	for i, handler := range h.handlers {
		handlers[i] = handler.WithAttrs(attrs)
	}
	return &MultiHandler{handlers: handlers}
}

// WithGroup returns a new MultiHandler with the given group name added to all handlers.
func (h *MultiHandler) WithGroup(name string) slog.Handler {
	handlers := make([]slog.Handler, len(h.handlers))
	for i, handler := range h.handlers {
		handlers[i] = handler.WithGroup(name)
	}
	return &MultiHandler{handlers: handlers}
}

// NewTestLogger creates a logger that writes JSON to the provided writer.
// Useful for capturing log output in tests.
func NewTestLogger(w io.Writer, level slog.Level) *slog.Logger {
	return slog.New(slog.NewJSONHandler(w, &slog.HandlerOptions{Level: level}))
}
