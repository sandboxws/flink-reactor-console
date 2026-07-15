package database

import (
	"testing"

	instruments "github.com/sandboxws/flink-reactor-instruments"
)

func TestHighlightResources(t *testing.T) {
	tests := []struct {
		name     string
		sql      string
		tables   []string
		expected []instruments.ResourceRef
	}{
		{
			name:   "source table from FROM clause",
			sql:    "SELECT * FROM `orders`",
			tables: []string{"public.orders", "public.users"},
			expected: []instruments.ResourceRef{
				{Name: "orders", Role: "source", PipelineRelevant: true},
			},
		},
		{
			name:   "sink table from INSERT INTO clause",
			sql:    "INSERT INTO `enriched_orders` SELECT * FROM `orders`",
			tables: []string{"public.orders", "public.enriched_orders"},
			expected: []instruments.ResourceRef{
				{Name: "orders", Role: "source", PipelineRelevant: true},
				{Name: "enriched_orders", Role: "sink", PipelineRelevant: true},
			},
		},
		{
			name:   "table from JDBC connector property",
			sql:    "CREATE TABLE src WITH ('connector' = 'jdbc', 'table-name' = 'users')",
			tables: []string{"public.users", "public.products"},
			expected: []instruments.ResourceRef{
				{Name: "users", Role: "source", PipelineRelevant: true},
			},
		},
		{
			name:     "no matching tables",
			sql:      "SELECT * FROM `unknown_table`",
			tables:   []string{"public.orders", "public.users"},
			expected: nil,
		},
		{
			name:   "unquoted identifiers",
			sql:    "SELECT * FROM orders",
			tables: []string{"public.orders"},
			expected: []instruments.ResourceRef{
				{Name: "orders", Role: "source", PipelineRelevant: true},
			},
		},
		{
			name:   "schema-qualified table in SQL",
			sql:    "SELECT * FROM public.orders",
			tables: []string{"public.orders"},
			expected: []instruments.ResourceRef{
				{Name: "public.orders", Role: "source", PipelineRelevant: true},
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			refs := extractDBRefsFromSQL(tt.sql)
			matched := matchAgainstTables(refs, tt.tables)

			if tt.expected == nil {
				if len(matched) != 0 {
					t.Errorf("expected no matches, got %d", len(matched))
				}
				return
			}

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
