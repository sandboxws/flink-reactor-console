package schemaregistry

import (
	"testing"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

func TestExtractSubjects(t *testing.T) {
	tests := []struct {
		name     string
		sql      string
		expected map[string]string
	}{
		{
			name: "explicit avro value subject",
			sql: `CREATE TABLE orders (id BIGINT) WITH (
				'connector' = 'kafka',
				'topic' = 'orders',
				'value.format' = 'avro-confluent',
				'value.avro-confluent.subject' = 'orders-canonical'
			)`,
			expected: map[string]string{"orders-canonical": "source"},
		},
		{
			name: "topic-name strategy for value",
			sql: `CREATE TABLE orders (id BIGINT) WITH (
				'connector' = 'kafka',
				'topic' = 'orders',
				'value.format' = 'avro-confluent'
			)`,
			expected: map[string]string{"orders-value": "source"},
		},
		{
			name: "topic-name strategy for key+value",
			sql: `CREATE TABLE orders (id BIGINT) WITH (
				'connector' = 'kafka',
				'topic' = 'orders',
				'key.format' = 'avro-confluent',
				'value.format' = 'avro-confluent'
			)`,
			expected: map[string]string{
				"orders-key":   "source",
				"orders-value": "source",
			},
		},
		{
			name: "protobuf-confluent format",
			sql: `CREATE TABLE events (id BIGINT) WITH (
				'connector' = 'kafka',
				'topic' = 'events',
				'value.format' = 'protobuf-confluent'
			)`,
			expected: map[string]string{"events-value": "source"},
		},
		{
			name: "non-confluent format ignored",
			sql: `CREATE TABLE plain (id BIGINT) WITH (
				'connector' = 'kafka',
				'topic' = 'plain',
				'value.format' = 'json'
			)`,
			expected: map[string]string{},
		},
		{
			name:     "no schema registry refs",
			sql:      "SELECT * FROM orders",
			expected: map[string]string{},
		},
		{
			name: "multiple tables",
			sql: `CREATE TABLE a (id BIGINT) WITH ('connector' = 'kafka', 'topic' = 'a', 'value.format' = 'avro-confluent');
				CREATE TABLE b (id BIGINT) WITH ('connector' = 'kafka', 'topic' = 'b', 'value.format' = 'protobuf-confluent')`,
			expected: map[string]string{
				"a-value": "source",
				"b-value": "source",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := extractSubjects(tt.sql)
			if len(got) != len(tt.expected) {
				t.Fatalf("expected %d subjects, got %d (%v)", len(tt.expected), len(got), got)
			}
			for k, v := range tt.expected {
				if got[k] != v {
					t.Errorf("expected refs[%q] = %q, got %q", k, v, got[k])
				}
			}
		})
	}
}

func TestMatchSubjects(t *testing.T) {
	candidates := map[string]string{
		"orders-value":  "source",
		"unknown-value": "source",
	}
	known := map[string]struct{}{
		"orders-value": {},
	}

	var refs []instruments.ResourceRef
	for subject, role := range candidates {
		if _, ok := known[subject]; !ok {
			continue
		}
		refs = append(refs, instruments.ResourceRef{
			Name:             subject,
			Role:             role,
			PipelineRelevant: true,
		})
	}

	if len(refs) != 1 {
		t.Fatalf("expected 1 matched subject, got %d (%v)", len(refs), refs)
	}
	if refs[0].Name != "orders-value" {
		t.Errorf("expected orders-value, got %q", refs[0].Name)
	}
}
