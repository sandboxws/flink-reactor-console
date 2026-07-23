package cluster

import (
	"slices"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
)

func TestCapabilitiesForVersion(t *testing.T) {
	tests := []struct {
		name     string
		version  string
		contains []string
		excludes []string
	}{
		{
			name:     "Flink 1.20 has no gated capabilities",
			version:  "1.20.0",
			contains: []string{},
			excludes: []string{"QUALIFY", "MATERIALIZED_TABLE", "CREATE_MODEL", "VECTOR_SEARCH"},
		},
		{
			name:     "Flink 2.0 includes QUALIFY and MATERIALIZED_TABLE",
			version:  "2.0.0",
			contains: []string{"QUALIFY", "MATERIALIZED_TABLE"},
			excludes: []string{"CREATE_MODEL", "VECTOR_SEARCH"},
		},
		{
			name:     "Flink 2.1 includes CREATE_MODEL",
			version:  "2.1.0",
			contains: []string{"QUALIFY", "MATERIALIZED_TABLE", "CREATE_MODEL"},
			excludes: []string{"VECTOR_SEARCH"},
		},
		{
			name:     "Flink 2.2 includes all capabilities",
			version:  "2.2.0",
			contains: []string{"QUALIFY", "MATERIALIZED_TABLE", "CREATE_MODEL", "VECTOR_SEARCH", "MATERIALIZED_TABLE_BUCKETING"},
			excludes: []string{},
		},
		{
			name:    "Flink 2.3 adds the 2.3 capability set",
			version: "2.3.0",
			contains: []string{
				"MATERIALIZED_TABLE_BUCKETING",
				"MATERIALIZED_TABLE_SCHEMA",
				"MATERIALIZED_TABLE_START_MODE",
				"MATERIALIZED_TABLE_EVOLUTION",
				"UPSERT_ON_CONFLICT",
				"FROM_TO_CHANGELOG",
				"RESCALE_HISTORY",
				"ADAPTIVE_PARTITIONING",
				"APPLICATION_MODE",
			},
			excludes: []string{},
		},
		{
			name:    "Flink 2.3 RC/dev version (2.3-SNAPSHOT) still resolves the 2.3 set",
			version: "2.3-SNAPSHOT",
			contains: []string{
				"MATERIALIZED_TABLE_EVOLUTION",
				"FROM_TO_CHANGELOG",
				"APPLICATION_MODE",
			},
			excludes: []string{},
		},
		{
			name:     "short version format (2.0)",
			version:  "2.0",
			contains: []string{"QUALIFY", "MATERIALIZED_TABLE"},
			excludes: []string{"CREATE_MODEL"},
		},
		{
			name:     "invalid version returns empty",
			version:  "invalid",
			contains: []string{},
			excludes: []string{"QUALIFY"},
		},
		{
			name:     "empty version returns empty",
			version:  "",
			contains: []string{},
			excludes: []string{"QUALIFY"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			caps := CapabilitiesForVersion(tt.version)
			capsSet := make(map[string]bool, len(caps))
			for _, c := range caps {
				capsSet[c] = true
			}

			for _, want := range tt.contains {
				if !capsSet[want] {
					t.Errorf("expected capability %q for version %q, got %v", want, tt.version, caps)
				}
			}
			for _, exclude := range tt.excludes {
				if capsSet[exclude] {
					t.Errorf("unexpected capability %q for version %q, got %v", exclude, tt.version, caps)
				}
			}
		})
	}
}

// ASYNC_PROFILER requires BOTH Flink >= 1.19 and rest.profiling.enabled; either
// missing must suppress it.
func TestCapabilitiesForVersionAndConfig_AsyncProfiler(t *testing.T) {
	tests := []struct {
		name             string
		version          string
		profilingEnabled bool
		want             bool
	}{
		{"1.19 + enabled", "1.19.0", true, true},
		{"1.20 + enabled", "1.20.1", true, true},
		{"2.0 + enabled", "2.0.0", true, true},
		{"2.3-SNAPSHOT + enabled", "2.3-SNAPSHOT", true, true},
		{"1.19 but disabled", "1.19.0", false, false},
		{"enabled but 1.18 (too old)", "1.18.2", true, false},
		{"enabled but unparseable version", "garbage", true, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			caps := CapabilitiesForVersionAndConfig(tt.version, tt.profilingEnabled)
			has := slices.Contains(caps, "ASYNC_PROFILER")
			if has != tt.want {
				t.Errorf("ASYNC_PROFILER present = %v, want %v (caps=%v)", has, tt.want, caps)
			}
		})
	}
}

func TestProfilingEnabledFromConfig(t *testing.T) {
	tests := []struct {
		name string
		cfg  flink.JMConfig
		want bool
	}{
		{"enabled true", flink.JMConfig{{Key: "rest.profiling.enabled", Value: "true"}}, true},
		{"enabled false", flink.JMConfig{{Key: "rest.profiling.enabled", Value: "false"}}, false},
		{"key absent", flink.JMConfig{{Key: "rest.port", Value: "8081"}}, false},
		{"whitespace tolerated", flink.JMConfig{{Key: "rest.profiling.enabled", Value: " true "}}, true},
		{"empty config", flink.JMConfig{}, false},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := profilingEnabledFromConfig(tt.cfg); got != tt.want {
				t.Errorf("profilingEnabledFromConfig = %v, want %v", got, tt.want)
			}
		})
	}
}
