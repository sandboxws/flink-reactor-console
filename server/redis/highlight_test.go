package redis

import (
	"testing"

	instruments "github.com/sandboxws/flink-reactor-instruments"
)

func TestExtractRedisRefs(t *testing.T) {
	tests := []struct {
		name     string
		sql      string
		expected map[string]string
	}{
		{
			name: "key-pattern in redis connector",
			sql: `CREATE TABLE users (id BIGINT, name STRING) WITH (
				'connector' = 'redis',
				'key-pattern' = 'user:*'
			)`,
			expected: map[string]string{"user:*": "source"},
		},
		{
			name: "lookup.key-pattern in redis-lookup connector",
			sql: `CREATE TABLE lookup (id BIGINT, val STRING) WITH (
				'connector' = 'redis-lookup',
				'lookup.key-pattern' = 'session:*'
			)`,
			expected: map[string]string{"session:*": "source"},
		},
		{
			name: "key-prefix gets glob suffix",
			sql: `CREATE TABLE cache (k STRING, v STRING) WITH (
				'connector' = 'redis',
				'key-prefix' = 'cache:'
			)`,
			expected: map[string]string{"cache:*": "source"},
		},
		{
			name: "non-redis connector ignored",
			sql: `CREATE TABLE t (k STRING) WITH (
				'connector' = 'kafka',
				'key-pattern' = 'should-not-match'
			)`,
			expected: map[string]string{},
		},
		{
			name: "multiple redis tables",
			sql: `CREATE TABLE users (id BIGINT) WITH (
				'connector' = 'redis',
				'key-pattern' = 'user:*'
			);
			CREATE TABLE sessions (id BIGINT) WITH (
				'connector' = 'redis',
				'key-pattern' = 'sess:*'
			)`,
			expected: map[string]string{
				"user:*": "source",
				"sess:*": "source",
			},
		},
		{
			name:     "no redis connectors",
			sql:      "SELECT * FROM orders",
			expected: map[string]string{},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractRedisRefs(tt.sql)
			if len(got) != len(tt.expected) {
				t.Fatalf("expected %d refs, got %d (%v)", len(tt.expected), len(got), got)
			}
			for k, v := range tt.expected {
				if got[k] != v {
					t.Errorf("expected refs[%q] = %q, got %q", k, v, got[k])
				}
			}
		})
	}
}

func TestMatchAgainstKeys(t *testing.T) {
	tests := []struct {
		name     string
		patterns map[string]string
		keys     []string
		expected []instruments.ResourceRef
	}{
		{
			name:     "pattern matches at least one key",
			patterns: map[string]string{"user:*": "source"},
			keys:     []string{"user:1", "user:2", "session:abc"},
			expected: []instruments.ResourceRef{
				{Name: "user:*", Role: "source", PipelineRelevant: true},
			},
		},
		{
			name:     "pattern matches no keys",
			patterns: map[string]string{"user:*": "source"},
			keys:     []string{"session:abc"},
			expected: nil,
		},
		{
			name:     "exact match",
			patterns: map[string]string{"counter": "source"},
			keys:     []string{"counter", "other"},
			expected: []instruments.ResourceRef{
				{Name: "counter", Role: "source", PipelineRelevant: true},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := matchAgainstKeys(tt.patterns, tt.keys)

			if tt.expected == nil {
				if len(got) != 0 {
					t.Errorf("expected no matches, got %d (%v)", len(got), got)
				}
				return
			}

			for _, exp := range tt.expected {
				found := false
				for _, m := range got {
					if m.Name == exp.Name && m.Role == exp.Role && m.PipelineRelevant == exp.PipelineRelevant {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected ref %+v not found in %+v", exp, got)
				}
			}
		})
	}
}
