package schemaregistry

import (
	"context"
	"encoding/json"
	"fmt"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

const instrumentVersion = "0.1.0"

// Config is the JSON config schema for the Schema Registry instrument.
type Config struct {
	URL  string     `json:"url"`
	Auth AuthConfig `json:"auth"`
}

// Instrument implements the instruments.Instrument interface for Schema Registry.
type Instrument struct {
	name   string
	client *Client
}

// NewInstrument creates a Schema Registry instrument with the given instance name.
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
func (i *Instrument) Type() string { return "schemaregistry" }

// Capabilities returns the list of supported capabilities.
func (i *Instrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{
		instruments.CapabilityBrowse,
		instruments.CapabilityHighlight,
	}
}

// Init parses the config, creates the HTTP client and verifies connectivity.
func (i *Instrument) Init(ctx context.Context, cfg json.RawMessage) error {
	var sc Config
	if err := json.Unmarshal(cfg, &sc); err != nil {
		return fmt.Errorf("invalid schema registry config: %w", err)
	}

	client, err := NewClient(sc.URL, sc.Auth)
	if err != nil {
		return fmt.Errorf("schema registry client init failed: %w", err)
	}
	if err := client.Ping(ctx); err != nil {
		_ = client.Close()
		return err
	}

	i.client = client
	return nil
}

// Shutdown releases idle HTTP connections.
func (i *Instrument) Shutdown(_ context.Context) error {
	if i.client != nil {
		return i.client.Close()
	}
	return nil
}

// HealthCheck verifies the registry is reachable.
func (i *Instrument) HealthCheck(ctx context.Context) error {
	if i.client == nil {
		return fmt.Errorf("schema registry client not initialized")
	}
	return i.client.Ping(ctx)
}

// Client returns the underlying client for use by resolvers.
func (i *Instrument) Client() *Client {
	return i.client
}
