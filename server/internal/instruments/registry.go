package instruments

import (
	"context"
	"fmt"
	"log/slog"
	"sync"
	"time"
)

// HealthReporter receives health status updates for instruments.
type HealthReporter interface {
	ReportHealth(instrumentName string, healthy bool)
}

// noopHealthReporter is a no-op implementation of HealthReporter.
type noopHealthReporter struct{}

func (n *noopHealthReporter) ReportHealth(string, bool) {}

// RegistryOption configures a Registry.
type RegistryOption func(*Registry)

// WithHealthReporter sets a custom health reporter on the registry.
func WithHealthReporter(hr HealthReporter) RegistryOption {
	return func(r *Registry) {
		r.healthReporter = hr
	}
}

// instrumentState tracks runtime state for a registered instrument.
type instrumentState struct {
	inst            Instrument
	initialized     bool
	healthy         bool
	lastHealthCheck *time.Time
}

// Registry manages instrument lifecycle, health checks, and discovery.
type Registry struct {
	mu             sync.RWMutex
	instruments    map[string]*instrumentState
	logger         *slog.Logger
	cancel         context.CancelFunc
	healthReporter HealthReporter
}

// NewRegistry creates an empty instrument registry.
func NewRegistry(logger *slog.Logger, opts ...RegistryOption) *Registry {
	r := &Registry{
		instruments:    make(map[string]*instrumentState),
		logger:         logger,
		healthReporter: &noopHealthReporter{},
	}
	for _, opt := range opts {
		opt(r)
	}
	return r
}

// Register adds an instrument to the registry. It must be called before InitAll.
func (r *Registry) Register(inst Instrument) {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.instruments[inst.Name()] = &instrumentState{inst: inst}
}

// InitAll initializes instruments that have matching configs. Instruments whose
// Init fails are marked unhealthy but do not block other instruments.
func (r *Registry) InitAll(ctx context.Context, configs []InstrumentConfig) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	// Build a lookup from name to config.
	cfgByName := make(map[string]InstrumentConfig, len(configs))
	for _, c := range configs {
		cfgByName[c.Name] = c
	}

	for name, state := range r.instruments {
		cfg, ok := cfgByName[name]
		if !ok {
			r.logger.Warn("instrument registered but no config found", "name", name)
			continue
		}

		cfgJSON, err := cfg.ConfigJSON()
		if err != nil {
			r.logger.Error("instrument config marshal failed", "name", name, "error", err)
			state.healthy = false
			continue
		}

		if err := state.inst.Init(ctx, cfgJSON); err != nil {
			r.logger.Error("instrument init failed", "name", name, "error", err)
			state.healthy = false
			continue
		}

		state.initialized = true
		state.healthy = true
		r.logger.Info("instrument initialized", "name", name, "type", state.inst.Type())
	}

	return nil
}

// ShutdownAll shuts down every initialized instrument. Errors are logged but
// do not block shutdown of remaining instruments.
func (r *Registry) ShutdownAll(ctx context.Context) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	if r.cancel != nil {
		r.cancel()
	}

	for name, state := range r.instruments {
		if !state.initialized {
			continue
		}
		if err := state.inst.Shutdown(ctx); err != nil {
			r.logger.Error("instrument shutdown error", "name", name, "error", err)
		}
	}
}

// StartHealthChecks runs periodic health checks on all initialized instruments.
func (r *Registry) StartHealthChecks(ctx context.Context, interval time.Duration) {
	hcCtx, cancel := context.WithCancel(ctx)
	r.mu.Lock()
	r.cancel = cancel
	r.mu.Unlock()

	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-hcCtx.Done():
				return
			case <-ticker.C:
				r.runHealthChecks(hcCtx)
			}
		}
	}()
}

func (r *Registry) runHealthChecks(ctx context.Context) {
	r.mu.RLock()
	states := make([]*instrumentState, 0, len(r.instruments))
	names := make([]string, 0, len(r.instruments))
	for name, s := range r.instruments {
		if s.initialized {
			states = append(states, s)
			names = append(names, name)
		}
	}
	r.mu.RUnlock()

	for i, state := range states {
		now := time.Now()
		err := state.inst.HealthCheck(ctx)

		r.mu.Lock()
		state.lastHealthCheck = &now
		state.healthy = err == nil
		r.mu.Unlock()

		if err != nil {
			r.logger.Warn("instrument health check failed", "name", names[i], "error", err)
		}
		r.healthReporter.ReportHealth(names[i], err == nil)
	}
}

// List returns info about all registered instruments for the GraphQL query.
func (r *Registry) List() []InstrumentInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	result := make([]InstrumentInfo, 0, len(r.instruments))
	for _, state := range r.instruments {
		caps := state.inst.Capabilities()
		capStrings := make([]string, len(caps))
		for i, c := range caps {
			capStrings[i] = string(c)
		}

		result = append(result, InstrumentInfo{
			Name:            state.inst.Name(),
			DisplayName:     state.inst.DisplayName(),
			Type:            state.inst.Type(),
			Version:         state.inst.Version(),
			Healthy:         state.healthy,
			LastHealthCheck: state.lastHealthCheck,
			Capabilities:    capStrings,
		})
	}
	return result
}

// Get returns a registered instrument by name.
func (r *Registry) Get(name string) (Instrument, error) {
	r.mu.RLock()
	defer r.mu.RUnlock()

	state, ok := r.instruments[name]
	if !ok {
		return nil, fmt.Errorf("instrument %q not found", name)
	}
	if !state.initialized {
		return nil, fmt.Errorf("instrument %q not initialized", name)
	}
	return state.inst, nil
}
