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
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql"
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/generated"
)

// Server wraps an Echo server with middleware and health endpoints.
type Server struct {
	echo   *echo.Echo
	addr   string
	logger *slog.Logger
}

// New creates a Server listening on addr with the standard middleware chain
// and health endpoints registered.
func New(addr string, logger *slog.Logger, service *flink.Service, poller *flink.Poller, sqlClient *flink.Client) *Server {
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

	// Health endpoints.
	e.GET("/healthz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ok"})
	})
	e.GET("/readyz", func(c echo.Context) error {
		return c.JSON(http.StatusOK, map[string]string{"status": "ready"})
	})

	// GraphQL endpoint with WebSocket support for subscriptions.
	gqlSrv := handler.New(generated.NewExecutableSchema(generated.Config{
		Resolvers: &graphql.Resolver{
			Service:   service,
			Poller:    poller,
			SQLClient: sqlClient,
		},
	}))
	gqlSrv.AddTransport(transport.Options{})
	gqlSrv.AddTransport(transport.POST{})
	gqlSrv.AddTransport(&transport.Websocket{
		KeepAlivePingInterval: 10 * time.Second,
		Upgrader: websocket.Upgrader{
			CheckOrigin: func(_ *http.Request) bool { return true },
		},
	})
	e.Any("/graphql", echo.WrapHandler(gqlSrv))

	return &Server{
		echo:   e,
		addr:   addr,
		logger: logger,
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
