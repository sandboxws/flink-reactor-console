package fluss

import (
	"context"
	"encoding/json"
	"fmt"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

const instrumentVersion = "0.1.0"

// Instrument implements the instruments.Instrument interface for Apache Fluss.
type Instrument struct {
	name   string
	cfg    Config
	client *Client
}

// NewInstrument creates a Fluss instrument with the given instance name.
func NewInstrument(name string) *Instrument {
	return &Instrument{name: name}
}

// Name returns the unique instance name.
func (i *Instrument) Name() string { return i.name }

// DisplayName returns a human-readable name.
func (i *Instrument) DisplayName() string { return i.name }

// Version returns the instrument version.
func (i *Instrument) Version() string { return instrumentVersion }

// Type returns the instrument type identifier.
func (i *Instrument) Type() string { return "fluss" }

// Capabilities returns the list of supported capabilities. Fluss supports
// browsing databases/tables, surfacing TabletServer/bucket metrics, and
// highlighting Fluss catalog references in pipeline SQL.
func (i *Instrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{
		instruments.CapabilityBrowse,
		instruments.CapabilityMetrics,
		instruments.CapabilityHighlight,
	}
}

// Config returns the resolved configuration. Useful for resolvers that need to
// inspect bootstrap servers or SASL state before making admin calls.
func (i *Instrument) Config() Config { return i.cfg }

// Client returns the underlying Fluss admin client for use by resolvers.
func (i *Instrument) Client() *Client { return i.client }

// Init parses the Fluss config, validates it, and constructs the admin client.
// The cluster is not eagerly contacted here — HealthCheck is the canonical
// reachability probe.
func (i *Instrument) Init(_ context.Context, cfg json.RawMessage) error {
	var fc Config
	if err := json.Unmarshal(cfg, &fc); err != nil {
		return fmt.Errorf("invalid fluss config: %w", err)
	}
	if err := fc.Validate(); err != nil {
		return err
	}
	i.cfg = fc

	client, err := NewClient(fc)
	if err != nil {
		return fmt.Errorf("fluss client init failed: %w", err)
	}
	i.client = client
	return nil
}

// Shutdown releases idle HTTP connections held by the admin client.
func (i *Instrument) Shutdown(_ context.Context) error {
	if i.client != nil {
		return i.client.Close()
	}
	return nil
}

// HealthCheck verifies Fluss connectivity via a layered probe — ZooKeeper
// reachability (when configured), CoordinatorServer responsiveness, and at
// least one alive TabletServer. Each layer returns a *HealthError with a
// distinct category so the dashboard can render a granular indicator.
func (i *Instrument) HealthCheck(ctx context.Context) error {
	if i.client == nil {
		return fmt.Errorf("fluss client not initialized")
	}

	hcCtx, cancel := context.WithTimeout(ctx, healthTimeout)
	defer cancel()

	// (a) ZooKeeper reachability — only if explicitly configured. Skipping ZK
	// when the operator hasn't given us an ensemble keeps simple deployments
	// from failing health checks for a layer they don't run.
	if i.cfg.ZooKeeperEnsemble != "" {
		if err := dialZK(hcCtx, i.cfg.ZooKeeperEnsemble); err != nil {
			return &HealthError{Cat: HealthZKUnreachable, Err: err}
		}
	}

	// (b) CoordinatorServer responsiveness.
	if err := i.client.PingCoordinator(hcCtx); err != nil {
		return &HealthError{Cat: HealthCoordinatorUnresponsive, Err: err}
	}

	// (c) Tablet-server liveness — at least one alive.
	servers, err := i.client.ListTabletServers(hcCtx)
	if err != nil {
		return &HealthError{Cat: HealthCoordinatorUnresponsive, Err: fmt.Errorf("list tablet servers: %w", err)}
	}
	for _, s := range servers {
		if s.Alive {
			return nil
		}
	}
	return &HealthError{Cat: HealthNoTabletServers, Err: fmt.Errorf("no alive tablet servers (saw %d)", len(servers))}
}
