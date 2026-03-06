package k8s

import (
	"context"
	"encoding/json"
	"log/slog"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
)

// Watcher watches for FlinkBlueGreenDeployment state changes and publishes events
// via the EventBus. Uses the K8s watch API with automatic reconnection.
type Watcher struct {
	client *Client
	bus    *flink.EventBus[BlueGreenDeployment]
	logger *slog.Logger
	cancel context.CancelFunc
}

// NewWatcher creates a new BG deployment watcher.
func NewWatcher(client *Client, logger *slog.Logger) *Watcher {
	return &Watcher{
		client: client,
		bus:    flink.NewEventBus[BlueGreenDeployment](),
		logger: logger,
	}
}

// EventBus returns the event bus that emits BG deployment state changes.
func (w *Watcher) EventBus() *flink.EventBus[BlueGreenDeployment] {
	return w.bus
}

// Start begins watching for BG deployment changes in a background goroutine.
// The watch automatically reconnects on errors.
func (w *Watcher) Start(ctx context.Context) {
	watchCtx, cancel := context.WithCancel(ctx)
	w.cancel = cancel

	go w.watchLoop(watchCtx)
	w.logger.Info("blue-green deployment watcher started", "namespace", w.client.Namespace)
}

// Stop stops the watcher.
func (w *Watcher) Stop() {
	if w.cancel != nil {
		w.cancel()
	}
}

func (w *Watcher) watchLoop(ctx context.Context) {
	for {
		if ctx.Err() != nil {
			return
		}
		w.doWatch(ctx)

		// Back off before reconnecting
		select {
		case <-ctx.Done():
			return
		case <-time.After(5 * time.Second):
		}
	}
}

func (w *Watcher) doWatch(ctx context.Context) {
	watcher, err := w.client.Dynamic.Resource(GVR).Namespace(w.client.Namespace).Watch(ctx, metav1.ListOptions{})
	if err != nil {
		w.logger.Warn("failed to start BG deployment watch", "error", err)
		return
	}
	defer watcher.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case event, ok := <-watcher.ResultChan():
			if !ok {
				w.logger.Debug("BG deployment watch channel closed, will reconnect")
				return
			}
			if event.Type == watch.Modified || event.Type == watch.Added {
				w.handleEvent(event)
			}
		}
	}
}

func (w *Watcher) handleEvent(event watch.Event) {
	data, err := json.Marshal(event.Object)
	if err != nil {
		w.logger.Warn("failed to marshal watch event", "error", err)
		return
	}

	bg, err := ParseBlueGreenDeployment(data)
	if err != nil {
		w.logger.Warn("failed to parse BG deployment from watch event", "error", err)
		return
	}

	w.bus.Publish(*bg)
}
