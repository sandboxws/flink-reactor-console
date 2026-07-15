package kafka

import (
	"context"
	"encoding/json"
	"fmt"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

const instrumentVersion = "0.1.0"

// Config is the JSON config schema for the Kafka instrument.
type Config struct {
	Brokers []string    `json:"brokers"`
	SASL    *SASLConfig `json:"sasl,omitempty"`
	TLS     *TLSConfig  `json:"tls,omitempty"`
}

// SASLConfig holds SASL authentication settings.
type SASLConfig struct {
	Mechanism string `json:"mechanism"` // PLAIN, SCRAM-SHA-256, SCRAM-SHA-512
	Username  string `json:"username"`
	Password  string `json:"password"` //nolint:gosec // G101: config field, not a hardcoded credential
}

// TLSConfig holds TLS settings.
type TLSConfig struct {
	Enabled    bool   `json:"enabled"`
	CACert     string `json:"caCert,omitempty"`
	ClientCert string `json:"clientCert,omitempty"`
	ClientKey  string `json:"clientKey,omitempty"` //nolint:gosec // G101: config field, not a hardcoded credential
}

// Instrument implements the instruments.Instrument interface for Kafka.
type Instrument struct {
	name   string
	client *Client
}

// NewInstrument creates a Kafka instrument with the given instance name.
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
func (i *Instrument) Type() string { return "kafka" }

// Capabilities returns the list of supported capabilities.
func (i *Instrument) Capabilities() []instruments.Capability {
	return []instruments.Capability{
		instruments.CapabilityBrowse,
		instruments.CapabilityMetrics,
		instruments.CapabilityHighlight,
	}
}

// Init parses the Kafka config and creates the admin client.
func (i *Instrument) Init(_ context.Context, cfg json.RawMessage) error {
	var kc Config
	if err := json.Unmarshal(cfg, &kc); err != nil {
		return fmt.Errorf("invalid kafka config: %w", err)
	}

	if len(kc.Brokers) == 0 {
		return fmt.Errorf("kafka config: brokers required")
	}

	var opts []ClientOption
	if kc.SASL != nil {
		opts = append(opts, WithSASL(kc.SASL.Mechanism, kc.SASL.Username, kc.SASL.Password))
	}
	if kc.TLS != nil && kc.TLS.Enabled {
		opts = append(opts, WithTLS(kc.TLS.CACert, kc.TLS.ClientCert, kc.TLS.ClientKey))
	}

	client, err := NewClient(kc.Brokers, opts...)
	if err != nil {
		return fmt.Errorf("kafka client init failed: %w", err)
	}

	i.client = client
	return nil
}

// Shutdown closes the Kafka client.
func (i *Instrument) Shutdown(_ context.Context) error {
	if i.client != nil {
		i.client.Close()
	}
	return nil
}

// HealthCheck verifies broker connectivity.
func (i *Instrument) HealthCheck(ctx context.Context) error {
	if i.client == nil {
		return fmt.Errorf("kafka client not initialized")
	}
	return i.client.Ping(ctx)
}

// Client returns the underlying Kafka client for use by resolvers.
func (i *Instrument) Client() *Client {
	return i.client
}
