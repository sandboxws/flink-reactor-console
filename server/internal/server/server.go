// Package server provides the HTTP server, middleware, and health endpoints.
package server

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/99designs/gqlgen/graphql/handler/transport"
	"github.com/gorilla/websocket"
	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/generated"
	"github.com/sandboxws/flink-reactor/apps/server/internal/instruments"
	"github.com/sandboxws/flink-reactor/apps/server/internal/logs"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"github.com/sandboxws/flink-reactor/apps/server/internal/spa"
	"github.com/sandboxws/flink-reactor/apps/server/internal/tap"
)

// Config holds server configuration options.
type Config struct {
	// StaticDir is the path to dashboard static files for the SPA handler.
	// Empty string disables SPA serving.
	StaticDir string

	// TapLoader provides tap pipeline manifests. May be nil.
	TapLoader *tap.Loader
}

// Server wraps an Echo server with middleware and health endpoints.
type Server struct {
	echo   *echo.Echo
	addr   string
	logger *slog.Logger
}

// New creates a Server listening on addr with the standard middleware chain
// and health endpoints registered. The manager may be nil for testing without
// Flink connectivity. The registry may be nil if no instruments are configured.
func New(addr string, logger *slog.Logger, manager *cluster.Manager, registry *instruments.Registry, opts ...Option) *Server {
	cfg := Config{}
	for _, o := range opts {
		o(&cfg)
	}

	e := echo.New()
	e.HideBanner = true
	e.HidePort = true

	// Slowloris protection.
	e.Server.ReadHeaderTimeout = 10 * time.Second

	// Middleware chain: RequestID → Logging → Recovery → CORS.
	e.Use(middleware.RequestID())
	e.Use(middleware.RequestLoggerWithConfig(middleware.RequestLoggerConfig{
		LogURI:       true,
		LogStatus:    true,
		LogLatency:   true,
		LogMethod:    true,
		LogRequestID: true,
		LogValuesFunc: func(_ echo.Context, v middleware.RequestLoggerValues) error {
			logger.Info("request",
				"method", v.Method,
				"path", v.URI,
				"status", v.Status,
				"duration_ms", v.Latency.Milliseconds(),
				"request_id", v.RequestID,
			)
			return nil
		},
	}))
	e.Use(middleware.RecoverWithConfig(middleware.RecoverConfig{
		LogErrorFunc: func(_ echo.Context, err error, stack []byte) error {
			logger.Error("panic recovered",
				"error", fmt.Sprintf("%v", err),
				"stack", string(stack),
			)
			return err
		},
	}))
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins: []string{"*"},
		AllowMethods: []string{
			http.MethodGet,
			http.MethodPost,
			http.MethodPut,
			http.MethodDelete,
			http.MethodOptions,
		},
		AllowHeaders: []string{
			echo.HeaderContentType,
			echo.HeaderAuthorization,
			"X-Request-ID",
		},
		MaxAge: 86400,
	}))
	e.Use(observability.MetricsMiddleware())

	// Prometheus metrics endpoint.
	e.GET("/metrics", echo.WrapHandler(promhttp.Handler()))

	// Health endpoints.
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})
	e.GET("/readyz", readyzHandler(manager))

	// GraphQL endpoint with WebSocket support for subscriptions.
	resolver := &graphql.Resolver{
		Manager:            manager,
		InstrumentRegistry: registry,
		TapLoader:          cfg.TapLoader,
	}
	gqlSrv := handler.New(generated.NewExecutableSchema(generated.Config{
		Resolvers: resolver,
	}))
	gqlSrv.SetErrorPresenter(graphql.NewErrorPresenter(logger))
	gqlSrv.Use(observability.GraphQLMetrics{})
	gqlSrv.AddTransport(transport.Options{})
	gqlSrv.AddTransport(transport.GET{})
	gqlSrv.AddTransport(transport.POST{})
	gqlSrv.AddTransport(&transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool { return true },
		},
	})
	e.Any("/graphql", echo.WrapHandler(gqlSrv))

	// Log proxy endpoints (plain text, not GraphQL).
	logs.Register(e, manager)

	// SPA static file handler (registered last as catch-all).
	if cfg.StaticDir != "" {
		spa.Register(e, spa.Config{StaticDir: cfg.StaticDir}, logger)
	}

	return &Server{
		echo:   e,
		addr:   addr,
		logger: logger,
	}
}

// Option configures the Server.
type Option func(*Config)

// WithStaticDir sets the SPA static file directory.
func WithStaticDir(dir string) Option {
	return func(c *Config) {
		c.StaticDir = dir
	}
}

// WithTapLoader sets the tap manifest loader on the GraphQL resolver.
func WithTapLoader(loader *tap.Loader) Option {
	return func(c *Config) {
		c.TapLoader = loader
	}
}

// readyzHandler returns an Echo handler that checks the default cluster's
// health status. Returns 503 if the default cluster is unhealthy.
func readyzHandler(manager *cluster.Manager) echo.HandlerFunc {
	return func(c echo.Context) error {
		if manager == nil {
			return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
		}

		conn := manager.Default()
		if conn == nil {
			return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
		}

		if conn.Status() == cluster.StatusUnhealthy {
			return c.JSON(http.StatusServiceUnavailable, map[string]string{
				"status": "not ready",
				"reason": "default cluster unhealthy",
			})
		}

		return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
	}
}

// Echo returns the underlying echo.Echo instance.
// Useful for testing with e.ServeHTTP(rec, req) and for registering
// additional routes before Start().
func (s *Server) Echo() *echo.Echo {
	return s.echo
}

// Start begins listening and serving. It blocks until the server is shut down.
func (s *Server) Start(_ context.Context) error {
	s.logger.Info("server starting", "addr", s.addr)
	err := s.echo.Start(s.addr)
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

// Shutdown gracefully stops the server, allowing in-flight requests to complete.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("server shutting down")
	return s.echo.Shutdown(ctx)
}
