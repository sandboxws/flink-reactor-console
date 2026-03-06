package cluster

import (
	"testing"
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
