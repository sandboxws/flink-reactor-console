package flink

// JMConfigEntry represents a single config entry from GET /jobmanager/config.
type JMConfigEntry struct {
	Key   string `json:"key"`
	Value string `json:"value"`
}

// JMConfig is the GET /jobmanager/config response (array of key-value pairs).
type JMConfig = []JMConfigEntry

// JMEnvironmentJVM represents JVM info within the environment response.
type JMEnvironmentJVM struct {
	Version string   `json:"version"`
	Arch    string   `json:"arch"`
	Options []string `json:"options"`
}

// JMEnvironment represents the GET /jobmanager/environment response.
type JMEnvironment struct {
	JVM              JMEnvironmentJVM  `json:"jvm"`
	Classpath        []string          `json:"classpath"`
	SystemProperties map[string]string `json:"system-properties"`
}

// JMMetrics is a slice of MetricItem for JM metrics.
type JMMetrics = []MetricItem
