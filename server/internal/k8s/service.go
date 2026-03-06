package k8s

import (
	"context"
	"log/slog"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// Service provides a high-level API for blue-green deployment operations.
// It wraps the K8s client and watcher.
type Service struct {
	client  *Client
	watcher *Watcher
	logger  *slog.Logger
}

// NewService creates a new K8s service for blue-green deployments.
func NewService(client *Client, logger *slog.Logger) *Service {
	return &Service{
		client:  client,
		watcher: NewWatcher(client, logger),
		logger:  logger,
	}
}

// List returns all FlinkBlueGreenDeployments in the configured namespace.
func (s *Service) List(ctx context.Context) ([]BlueGreenDeployment, error) {
	return s.client.ListBlueGreenDeployments(ctx)
}

// Get returns a single FlinkBlueGreenDeployment by name.
func (s *Service) Get(ctx context.Context, name string) (*BlueGreenDeployment, error) {
	return s.client.GetBlueGreenDeployment(ctx, name)
}

// EventBus returns the event bus for BG deployment state changes.
func (s *Service) EventBus() *flink.EventBus[BlueGreenDeployment] {
	return s.watcher.EventBus()
}

// Start begins watching for BG deployment changes.
func (s *Service) Start(ctx context.Context) {
	s.watcher.Start(ctx)
}

// Stop stops the watcher.
func (s *Service) Stop() {
	s.watcher.Stop()
}
