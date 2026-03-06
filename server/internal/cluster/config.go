package cluster

import (
	"encoding/json"
	"fmt"
)

// Config holds the configuration for a single Flink cluster connection.
type Config struct {
	Name          string `json:"name"`
	URL           string `json:"url"`
	Token         string `json:"token,omitempty"` //nolint:gosec // G117: bearer token for Flink API auth, not a hardcoded secret
	SQLGatewayURL string `json:"sql_gateway_url,omitempty"`
	Default       bool   `json:"default,omitempty"`

	// Kubernetes configuration (optional, enables BG deployment monitoring)
	KubeConfig    string `json:"kube_config,omitempty"`
	KubeContext   string `json:"kube_context,omitempty"`
	KubeNamespace string `json:"kube_namespace,omitempty"`
}

// ParseClustersEnv parses cluster configuration from environment variables.
//
// Multi-cluster mode: if clustersJSON is non-empty, it is parsed as a JSON array
// of Config entries. Single-cluster mode: a synthetic "default" cluster
// is created from flinkURL (with optional authToken and sqlGatewayURL).
//
// Returns an error if no configuration is provided or JSON is malformed.
func ParseClustersEnv(clustersJSON, flinkURL, authToken, sqlGatewayURL string) ([]Config, error) {
	if clustersJSON != "" {
		var configs []Config
		if err := json.Unmarshal([]byte(clustersJSON), &configs); err != nil {
			return nil, fmt.Errorf("parsing CLUSTERS env: %w", err)
		}
		if len(configs) == 0 {
			return nil, fmt.Errorf("CLUSTERS env is an empty array")
		}
		for i, c := range configs {
			if c.Name == "" {
				return nil, fmt.Errorf("cluster at index %d missing name", i)
			}
			if c.URL == "" {
				return nil, fmt.Errorf("cluster %q missing url", c.Name)
			}
		}
		return configs, nil
	}

	if flinkURL == "" {
		return nil, fmt.Errorf("neither CLUSTERS nor FLINK_REST_URL is set")
	}

	return []Config{{
		Name:          "default",
		URL:           flinkURL,
		Token:         authToken,
		SQLGatewayURL: sqlGatewayURL,
		Default:       true,
	}}, nil
}
