package server

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"time"

	"github.com/99designs/gqlgen/graphql/handler"
	"github.com/flink-reactor/server/internal/graphql"
	"github.com/flink-reactor/server/internal/graphql/generated"
)

// Server wraps an HTTP server with middleware and health endpoints.
type Server struct {
	httpServer *http.Server
	mux        *http.ServeMux
	logger     *slog.Logger
}

// New creates a Server listening on addr with the standard middleware chain
// and health endpoints registered.
func New(addr string, logger *slog.Logger) *Server {
	mux := http.NewServeMux()

	mux.HandleFunc("GET /healthz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ok"})
	})

	mux.HandleFunc("GET /readyz", func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "ready"})
	})

	// GraphQL endpoint.
	gqlSrv := handler.NewDefaultServer(generated.NewExecutableSchema(generated.Config{
		Resolvers: &graphql.Resolver{},
	}))
	mux.Handle("POST /graphql", gqlSrv)

	// Middleware chain: RequestID → Logging → Recovery → CORS
	// Applied in reverse order because each wraps the next.
	var handler http.Handler = mux
	handler = CORS([]string{"*"})(handler)
	handler = Recovery(logger)(handler)
	handler = Logging(logger)(handler)
	handler = RequestID(handler)

	return &Server{
		httpServer: &http.Server{
			Addr:              addr,
			Handler:           handler,
			ReadHeaderTimeout: 10 * time.Second,
		},
		mux:    mux,
		logger: logger,
	}
}

// Handle registers a handler on the server's mux. This must be called
// before Start(). The pattern follows Go 1.22+ ServeMux syntax (e.g., "POST /graphql").
func (s *Server) Handle(pattern string, handler http.Handler) {
	s.mux.Handle(pattern, handler)
}

// Handler returns the server's top-level HTTP handler (with middleware applied).
// Useful for testing with httptest.NewServer.
func (s *Server) Handler() http.Handler {
	return s.httpServer.Handler
}

// Start begins listening and serving. It blocks until the server is shut down.
func (s *Server) Start(_ context.Context) error {
	s.logger.Info("server starting", "addr", s.httpServer.Addr)
	err := s.httpServer.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

// Shutdown gracefully stops the server, allowing in-flight requests to complete.
func (s *Server) Shutdown(ctx context.Context) error {
	s.logger.Info("server shutting down")
	return s.httpServer.Shutdown(ctx)
}
