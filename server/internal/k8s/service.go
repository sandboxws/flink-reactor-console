package k8s

import (
	"context"
	"log/slog"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
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

// ConfigDiff returns the YAML-rendered blue and pending-green configurations
// for a FlinkBlueGreenDeployment.
func (s *Service) ConfigDiff(ctx context.Context, name string) (*ConfigDiff, error) {
	return s.client.BlueGreenConfigDiff(ctx, name)
}

// ListOOMKills lists TaskManager pods and returns any whose containers were
// OOM-killed (reason "OOMKilled" or exit code 137). UNVERIFIED against a live
// cluster — the pod listing has not been exercised against a real API server.
func (s *Service) ListOOMKills(ctx context.Context) ([]OOMKill, error) {
	pods, err := s.client.listTaskManagerPods(ctx)
	if err != nil {
		return nil, err
	}
	return oomKillsFromPods(pods), nil
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
