package cluster

// Config holds the configuration for a single Flink cluster connection.
type Config struct {
	Name          string `json:"name" mapstructure:"name"`
	URL           string `json:"url" mapstructure:"url"`
	Token         string `json:"token,omitempty" mapstructure:"token"` //nolint:gosec // G117: bearer token for Flink API auth, not a hardcoded secret
	SQLGatewayURL string `json:"sql_gateway_url,omitempty" mapstructure:"sql_gateway_url"`
	Default       bool   `json:"default,omitempty" mapstructure:"default"`

	// Kubernetes configuration (optional, enables BG deployment monitoring)
	KubeConfig    string `json:"kube_config,omitempty" mapstructure:"kube_config"`
	KubeContext   string `json:"kube_context,omitempty" mapstructure:"kube_context"`
	KubeNamespace string `json:"kube_namespace,omitempty" mapstructure:"kube_namespace"`
}
