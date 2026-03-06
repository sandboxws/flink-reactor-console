package cluster

import (
	"fmt"
	"io"
	"log/slog"
	"net/http/httptest"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// NewTestManager creates a Manager from mock HTTP servers for use in tests.
// The first server is designated as the default cluster ("cluster-0").
// Each server gets a cluster named "cluster-N" where N is its index.
func NewTestManager(servers ...*httptest.Server) *Manager {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))
	configs := make([]Config, len(servers))
	for i, srv := range servers {
		configs[i] = Config{
			Name:    fmt.Sprintf("cluster-%d", i),
			URL:     srv.URL,
			Default: i == 0,
		}
	}

	m := &Manager{}
	_ = m.Init(configs, logger)
	return m
}

// NewTestManagerWithSQL creates a Manager with a single cluster that has
// both a Flink REST server and a SQL Gateway server.
func NewTestManagerWithSQL(flinkServer, sqlServer *httptest.Server) *Manager {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	client := flink.NewClient(flink.WithBaseURL(flinkServer.URL))
	service := flink.NewService(client)
	poller := flink.NewPoller(service)
	sqlClient := flink.NewClient(flink.WithBaseURL(sqlServer.URL))

	m := &Manager{
		connections: map[string]*Connection{
			"default": {
				Name:      "default",
				URL:       flinkServer.URL,
				Service:   service,
				Poller:    poller,
				SQLClient: sqlClient,
				status:    StatusUnknown,
			},
		},
		defaultName: "default",
		logger:      logger,
	}
	return m
}

// NewTestManagerWithPoller creates a Manager with a single default cluster
// using a custom poller (useful for subscription tests with mockJobGetter).
func NewTestManagerWithPoller(poller *flink.Poller) *Manager {
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	m := &Manager{
		connections: map[string]*Connection{
			"default": {
				Name:   "default",
				URL:    "http://test:8081",
				Poller: poller,
				status: StatusUnknown,
			},
		},
		defaultName: "default",
		logger:      logger,
	}
	return m
}
