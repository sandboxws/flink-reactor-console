package redis

import (
	"context"
	"encoding/json"
	"fmt"

	instruments "github.com/sandboxws/flink-reactor-instruments"
)

const instrumentVersion = "0.1.0"

// Config is the JSON config schema for the Redis instrument.
type Config struct {
	Addr     string     `json:"addr"`
	Password string     `json:"password,omitempty"` //nolint:gosec // G101: config field, not a hardcoded credential
	DB       int        `json:"db,omitempty"`
	TLS      *TLSConfig `json:"tls,omitempty"`
}

// TLSConfig holds TLS settings for the Redis connection.
type TLSConfig struct {
	Enabled    bool   `json:"enabled"`
	CACert     string `json:"caCert,omitempty"`
	ClientCert string `json:"clientCert,omitempty"`
	ClientKey  string `json:"clientKey,omitempty"` //nolint:gosec // G101: config field, not a hardcoded credential
}

// Instrument implements the instruments.Instrument interface for Redis.
type Instrument struct {
	name   string
	client *Client
}

// NewInstrument creates a Redis instrument with the given instance name.
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
func (i *Instrument) Type() string { return "redis" }

// Capabilities returns the list of supported capabilities.
func (i *Instrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{
		instruments.CapabilityBrowse,
		instruments.CapabilityMetrics,
		instruments.CapabilityHighlight,
	}
}

// Init parses the Redis config, creates the client and verifies connectivity.
func (i *Instrument) Init(ctx context.Context, cfg json.RawMessage) error {
	var rc Config
	if err := json.Unmarshal(cfg, &rc); err != nil {
		return fmt.Errorf("invalid redis config: %w", err)
	}
	if rc.Addr == "" {
		return fmt.Errorf("redis config: addr required")
	}

	var opts []ClientOption
	if rc.Password != "" {
		opts = append(opts, WithPassword(rc.Password))
	}
	if rc.DB != 0 {
		opts = append(opts, WithDB(rc.DB))
	}
	if rc.TLS != nil && rc.TLS.Enabled {
		opts = append(opts, WithTLS(rc.TLS.CACert, rc.TLS.ClientCert, rc.TLS.ClientKey))
	}

	client, err := NewClient(rc.Addr, opts...)
	if err != nil {
		return fmt.Errorf("redis client init failed: %w", err)
	}
	if err := client.Ping(ctx); err != nil {
		_ = client.Close()
		return err
	}

	i.client = client
	return nil
}

// Shutdown closes the Redis connection.
func (i *Instrument) Shutdown(_ context.Context) error {
	if i.client != nil {
		return i.client.Close()
	}
	return nil
}

// HealthCheck verifies Redis connectivity.
func (i *Instrument) HealthCheck(ctx context.Context) error {
	if i.client == nil {
		return fmt.Errorf("redis client not initialized")
	}
	return i.client.Ping(ctx)
}

// Client returns the underlying Redis client for use by resolvers.
func (i *Instrument) Client() *Client {
	return i.client
}
