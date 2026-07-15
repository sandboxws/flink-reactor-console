package kafka

import (
	"testing"

	instruments "github.com/sandboxws/flink-reactor-console/server/internal/instruments"
)

func TestHighlightResources(t *testing.T) {
	tests := []struct {
		name     string
		sql      string
		topics   []string
		expected []instruments.ResourceRef
	}{
		{
			name:   "source topic from FROM clause",
			sql:    "SELECT * FROM `orders`",
			topics: []string{"orders", "users", "products"},
			expected: []instruments.ResourceRef{
				{Name: "orders", Role: "source", PipelineRelevant: true},
			},
		},
		{
			name:   "sink topic from INSERT INTO clause",
			sql:    "INSERT INTO `enriched_orders` SELECT * FROM `orders`",
			topics: []string{"orders", "enriched_orders"},
			expected: []instruments.ResourceRef{
				{Name: "orders", Role: "source", PipelineRelevant: true},
				{Name: "enriched_orders", Role: "sink", PipelineRelevant: true},
			},
		},
		{
			name:   "topic from connector property",
			sql:    "CREATE TABLE src WITH ('connector' = 'kafka', 'topic' = 'events')",
			topics: []string{"events", "other"},
			expected: []instruments.ResourceRef{
				{Name: "events", Role: "source", PipelineRelevant: true},
			},
		},
		{
			name:     "no matching topics",
			sql:      "SELECT * FROM `unknown_table`",
			topics:   []string{"orders", "users"},
			expected: nil,
		},
		{
			name:   "unquoted identifiers",
			sql:    "SELECT * FROM orders",
			topics: []string{"orders"},
			expected: []instruments.ResourceRef{
				{Name: "orders", Role: "source", PipelineRelevant: true},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// We test the regex extraction logic directly since we can't mock
			// the franz-go client easily. We'll test the pattern matching.
			refs := extractRefsFromSQL(tt.sql)
			matched := matchAgainstTopics(refs, tt.topics)

			if tt.expected == nil {
				if len(matched) != 0 {
					t.Errorf("expected no matches, got %d", len(matched))
				}
				return
			}

			// Check all expected refs are present (order may vary).
			for _, exp := range tt.expected {
				found := false
				for _, m := range matched {
					if m.Name == exp.Name && m.Role == exp.Role && m.PipelineRelevant == exp.PipelineRelevant {
						found = true
						break
					}
				}
				if !found {
					t.Errorf("expected ref %+v not found in results %+v", exp, matched)
				}
			}
		})
	}
}

// extractRefsFromSQL extracts topic name -> role mappings from SQL.
func extractRefsFromSQL(sql string) map[string]string {
	refs := make(map[string]string)

	for _, match := range fromPattern.FindAllStringSubmatch(sql, -1) {
		refs[match[1]] = "source"
	}
	for _, match := range insertIntoPattern.FindAllStringSubmatch(sql, -1) {
		refs[match[1]] = "sink"
	}
	for _, match := range topicPropPattern.FindAllStringSubmatch(sql, -1) {
		if _, exists := refs[match[1]]; !exists {
			refs[match[1]] = "source"
		}
	}

	return refs
}

// matchAgainstTopics filters refs to only those matching known topics.
func matchAgainstTopics(refs map[string]string, topics []string) []instruments.ResourceRef {
	known := make(map[string]bool, len(topics))
	for _, t := range topics {
		known[t] = true
	}

	var result []instruments.ResourceRef
	for name, role := range refs {
		if known[name] {
			result = append(result, instruments.ResourceRef{
				Name:             name,
				Role:             role,
				PipelineRelevant: true,
			})
		}
	}
	return result
}
