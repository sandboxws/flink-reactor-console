package fluss

import (
	"fmt"
	"strings"
)

// Config is the JSON config schema for the Fluss instrument.
//
// Fluss exposes its admin/metadata API over a CoordinatorServer endpoint
// configured via `bootstrapServers` (host:port). SASL is optional; when
// enabled, the instrument carries the SASL handshake on every metadata call.
//
// The optional `adminEndpoint` overrides the HTTP base used by the metadata
// client when it differs from the bootstrap server (e.g. a sidecar exposing
// metadata over HTTP/JSON in front of the native RPC port).
type Config struct {
	BootstrapServers string `json:"bootstrapServers"`
	AdminEndpoint    string `json:"adminEndpoint,omitempty"`

	SASLEnabled   bool   `json:"saslEnabled,omitempty"`
	SASLMechanism string `json:"saslMechanism,omitempty"`
	SASLUsername  string `json:"saslUsername,omitempty"`
	SASLPassword  string `json:"saslPassword,omitempty"` //nolint:gosec // G101: config field, not a hardcoded credential

	// ZooKeeperEnsemble is an optional ZK quorum used by the health-check
	// probe. Fluss historically tracks coordinator leadership in ZK; pre-flight
	// pinging ZK gives a more granular health signal than waiting for the
	// admin call to time out. If empty, the ZK probe is skipped and the
	// HealthCheck collapses to coordinator + tablet-server checks.
	ZooKeeperEnsemble string `json:"zookeeperEnsemble,omitempty"`
}

// Validate normalizes whitespace and rejects missing required fields.
func (c *Config) Validate() error {
	c.BootstrapServers = strings.TrimSpace(c.BootstrapServers)
	c.AdminEndpoint = strings.TrimSpace(c.AdminEndpoint)
	c.ZooKeeperEnsemble = strings.TrimSpace(c.ZooKeeperEnsemble)

	if c.BootstrapServers == "" {
		return fmt.Errorf("fluss config: bootstrapServers required")
	}
	if c.SASLEnabled {
		if c.SASLMechanism == "" {
			return fmt.Errorf("fluss config: saslMechanism required when SASL enabled")
		}
		if c.SASLUsername == "" || c.SASLPassword == "" {
			return fmt.Errorf("fluss config: saslUsername and saslPassword required when SASL enabled")
		}
	}
	return nil
}

// adminBaseURL returns the HTTP base URL the metadata client should use.
// Defaults to `http://<bootstrapServers>` when adminEndpoint is unset.
func (c *Config) adminBaseURL() string {
	if c.AdminEndpoint != "" {
		return strings.TrimRight(c.AdminEndpoint, "/")
	}
	return "http://" + c.BootstrapServers
}
