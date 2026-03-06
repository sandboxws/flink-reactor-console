// Package spa provides a static file server with SPA (single-page application)
// fallback for client-side routing.
package spa

import (
	"io/fs"
	"log/slog"
	"os"
	"path/filepath"
	"strings"

	"github.com/labstack/echo/v4"
)

// Config holds SPA handler configuration.
type Config struct {
	// StaticDir is the path to the static files directory.
	// Defaults to "./static" if empty.
	StaticDir string
}

// Register registers the SPA handler on the Echo instance.
// It should be called after all API routes are registered so that
// API routes take precedence over the SPA catch-all.
func Register(e *echo.Echo, cfg Config, logger *slog.Logger) {
	dir := cfg.StaticDir
	if dir == "" {
		dir = "./static"
	}

	absDir, err := filepath.Abs(dir)
	if err != nil {
		logger.Warn("spa: could not resolve static dir", "dir", dir, "error", err)
		absDir = dir
	}

	// Check if directory exists at startup.
	if _, err := os.Stat(absDir); os.IsNotExist(err) {
		logger.Warn("spa: static directory does not exist, SPA handler will 404", "dir", absDir)
	} else {
		logger.Info("spa: serving static files", "dir", absDir)
	}

	e.Use(spaMiddleware(absDir))
}

// spaMiddleware returns an Echo middleware that serves static files with SPA
// fallback. It checks if the requested path corresponds to a real file; if so,
// it serves the file with appropriate cache headers. Otherwise, it serves
// index.html for client-side routing.
func spaMiddleware(staticDir string) echo.MiddlewareFunc {
	fsys := os.DirFS(staticDir)

	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			path := c.Request().URL.Path

			// Skip API paths — let them fall through to registered handlers.
			if strings.HasPrefix(path, "/graphql") ||
				strings.HasPrefix(path, "/healthz") ||
				strings.HasPrefix(path, "/readyz") ||
				strings.HasPrefix(path, "/api/") {
				return next(c)
			}

			// Clean the path for filesystem lookup.
			cleanPath := strings.TrimPrefix(path, "/")
			if cleanPath == "" {
				cleanPath = "index.html"
			}

			// Try to open the file.
			f, err := fs.Stat(fsys, cleanPath)
			if err == nil && !f.IsDir() {
				// File exists — serve it with cache headers.
				setCacheHeaders(c, cleanPath)
				return c.File(filepath.Join(staticDir, cleanPath))
			}

			// Check if it's a directory with an index.html.
			if err == nil && f.IsDir() {
				indexPath := filepath.Join(cleanPath, "index.html")
				if _, err := fs.Stat(fsys, indexPath); err == nil {
					setCacheHeaders(c, "index.html")
					return c.File(filepath.Join(staticDir, indexPath))
				}
			}

			// SPA fallback: serve index.html for unmatched paths.
			indexFile := filepath.Join(staticDir, "index.html")
			if _, err := os.Stat(indexFile); err != nil {
				// No index.html — fall through to next handler (likely 404).
				return next(c)
			}
			c.Response().Header().Set("Cache-Control", "no-cache")
			return c.File(indexFile)
		}
	}
}

// setCacheHeaders sets appropriate Cache-Control headers based on the file path.
// Hashed assets (under _next/static/) get long-term caching.
// index.html gets no-cache for instant updates on deployment.
func setCacheHeaders(c echo.Context, path string) {
	if strings.Contains(path, "_next/static/") || strings.Contains(path, "/_next/static/") {
		c.Response().Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else if strings.HasSuffix(path, "index.html") || path == "" {
		c.Response().Header().Set("Cache-Control", "no-cache")
	} else {
		// Other static files get moderate caching.
		c.Response().Header().Set("Cache-Control", "public, max-age=3600")
	}
}
