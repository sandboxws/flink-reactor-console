package cluster

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/observability"
	"golang.org/x/sync/errgroup"
)

const defaultHealthCheckInterval = 30 * time.Second

// Manager is a thread-safe registry of named Flink cluster connections.
// It supports multi-cluster routing via Resolve and runs periodic health checks.
type Manager struct {
	mu          sync.RWMutex
	connections map[string]*Connection
	defaultName string
	logger      *slog.Logger

	cancel context.CancelFunc
}

// Init creates connections from the given cluster configs. Exactly one cluster
// is designated as default: the first with Default=true, or the first entry.
// Returns an error if configs is empty.
func (m *Manager) Init(configs []Config, logger *slog.Logger) error {
	if len(configs) == 0 {
		return fmt.Errorf("no cluster configurations provided")
	}

	m.logger = logger
	m.connections = make(map[string]*Connection, len(configs))

	defaultSet := false
	for _, cfg := range configs {
		conn := m.buildConnection(cfg, logger)
		m.connections[cfg.Name] = conn

		if cfg.Default && !defaultSet {
			m.defaultName = cfg.Name
			defaultSet = true
		}
	}

	// If no explicit default, use the first entry.
	if !defaultSet {
		m.defaultName = configs[0].Name
	}

	// Warn if multiple defaults were specified.
	defaultCount := 0
	for _, cfg := range configs {
		if cfg.Default {
			defaultCount++
		}
	}
	if defaultCount > 1 {
		logger.Warn("multiple clusters marked as default, using first one",
			"default", m.defaultName,
			"count", defaultCount,
		)
	}

	logger.Info("cluster manager initialized",
		"clusters", len(configs),
		"default", m.defaultName,
	)

	return nil
}

// buildConnection creates a Connection with its full Flink client stack.
func (m *Manager) buildConnection(cfg Config, logger *slog.Logger) *Connection {
	metricsHook := flink.MetricsHook(func(_, path string, statusCode int, durationSeconds float64) {
		status := fmt.Sprintf("%d", statusCode)
		observability.FlinkUpstreamRequestsTotal.WithLabelValues(cfg.Name, path, status).Inc()
		observability.FlinkUpstreamRequestDuration.WithLabelValues(cfg.Name, path).Observe(durationSeconds)
	})
	clientOpts := []flink.ClientOption{
		flink.WithBaseURL(cfg.URL),
		flink.WithLogger(logger),
		flink.WithMetricsHook(metricsHook),
	}
	if cfg.Token != "" {
		clientOpts = append(clientOpts, flink.WithBearerAuth(cfg.Token))
	}
	client := flink.NewClient(clientOpts...)
	service := flink.NewService(client)
	poller := flink.NewPoller(service, flink.WithPollerLogger(logger))

	conn := &Connection{
		Name:    cfg.Name,
		URL:     cfg.URL,
		Service: service,
		Poller:  poller,
		status:  StatusUnknown,
	}

	if cfg.SQLGatewayURL != "" {
		sqlOpts := []flink.ClientOption{
			flink.WithBaseURL(cfg.SQLGatewayURL),
			flink.WithLogger(logger),
			flink.WithMetricsHook(metricsHook),
		}
		if cfg.Token != "" {
			sqlOpts = append(sqlOpts, flink.WithBearerAuth(cfg.Token))
		}
		conn.SQLClient = flink.NewClient(sqlOpts...)
	}

	return conn
}

// Get returns the connection for the given cluster name.
// Returns an error if the cluster is not found.
func (m *Manager) Get(name string) (*Connection, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	conn, ok := m.connections[name]
	if !ok {
		return nil, fmt.Errorf("cluster %q not found", name)
	}
	return conn, nil
}

// Default returns the default cluster connection.
func (m *Manager) Default() *Connection {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return m.connections[m.defaultName]
}

// Resolve returns the named cluster connection, or the default if name is nil.
func (m *Manager) Resolve(name *string) (*Connection, error) {
	if name == nil {
		return m.Default(), nil
	}
	return m.Get(*name)
}

// List returns a snapshot of all cluster info for the GraphQL clusters query.
func (m *Manager) List() []Info {
	m.mu.RLock()
	defer m.mu.RUnlock()

	infos := make([]Info, 0, len(m.connections))
	for _, conn := range m.connections {
		info := Info{
			Name:   conn.Name,
			URL:    conn.URL,
			Status: conn.Status(),
		}
		if t := conn.LastCheckTime(); !t.IsZero() {
			t := t // copy for pointer
			info.LastCheckTime = &t
		}
		if v := conn.Version(); v != "" {
			v := v // copy for pointer
			info.Version = &v
		}
		infos = append(infos, info)
	}
	return infos
}

// HealthCheck runs a parallel health check against all clusters.
// Each cluster's GET /overview is called concurrently via errgroup with limit 10.
// Health check results update individual connection status.
func (m *Manager) HealthCheck(ctx context.Context) {
	m.mu.RLock()
	conns := make([]*Connection, 0, len(m.connections))
	for _, conn := range m.connections {
		conns = append(conns, conn)
	}
	m.mu.RUnlock()

	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(10)

	for _, conn := range conns {
		conn := conn // capture loop var
		g.Go(func() error {
			overview, err := conn.Service.GetClusterOverview(ctx)
			if err != nil {
				conn.setUnhealthy()
				m.logger.Warn("cluster health check failed",
					"cluster", conn.Name,
					"error", err,
				)
			} else {
				conn.setHealthy(overview.FlinkVersion)
			}
			return nil // never fail the errgroup — health checks are best-effort
		})
	}

	_ = g.Wait()
}

// Start runs an initial synchronous health check, then spawns a background
// goroutine that repeats health checks at the given interval.
func (m *Manager) Start(ctx context.Context, interval time.Duration) {
	if interval <= 0 {
		interval = defaultHealthCheckInterval
	}

	// Initial synchronous health check.
	m.HealthCheck(ctx)

	bgCtx, cancel := context.WithCancel(ctx)
	m.cancel = cancel

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-bgCtx.Done():
				return
			case <-ticker.C:
				m.HealthCheck(bgCtx)
			}
		}
	}()

	m.logger.Info("cluster health checks started", "interval", interval)
}

// Stop cancels the background health check goroutine and stops all pollers.
func (m *Manager) Stop() {
	if m.cancel != nil {
		m.cancel()
	}

	m.mu.RLock()
	defer m.mu.RUnlock()

	for _, conn := range m.connections {
		conn.Poller.Stop()
	}
}
