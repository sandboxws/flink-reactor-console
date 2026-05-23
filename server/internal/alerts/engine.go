package alerts

import (
	"context"
	"log/slog"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/cluster"
	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
	"github.com/sandboxws/flink-reactor/apps/server/internal/store"
)

// Engine is the top-level wrapper that ties together the Evaluator (writes
// instances) and Listener (reads NOTIFY → in-process bus). Subscribers
// consume from Bus().
type Engine struct {
	bus       *flink.EventBus[InstanceEvent]
	evaluator *Evaluator
	listener  *Listener
}

// NewEngine constructs an Engine. tick is the evaluator interval (default 5s).
func NewEngine(stores *store.Stores, manager *cluster.Manager, tick time.Duration, logger *slog.Logger) *Engine {
	bus := flink.NewEventBus[InstanceEvent]()
	return &Engine{
		bus:       bus,
		evaluator: NewEvaluator(stores, manager, tick, logger),
		listener:  NewListener(stores.Pool(), stores, bus, logger),
	}
}

// Bus returns the in-process subscription bus.
func (e *Engine) Bus() *flink.EventBus[InstanceEvent] { return e.bus }

// Start spawns the evaluator and listener goroutines.
func (e *Engine) Start(ctx context.Context) {
	e.evaluator.Start(ctx)
	e.listener.Start(ctx)
}

// Stop halts both. Idempotent.
func (e *Engine) Stop() {
	e.evaluator.Stop()
	e.listener.Stop()
}
