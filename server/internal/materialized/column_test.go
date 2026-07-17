package materialized

import "testing"

// TestParseColumnRow uses rows captured verbatim from a real Flink 2.3 SQL
// Gateway `DESCRIBE` result (columns: name, type, null, key, extras, watermark).
func TestParseColumnRow(t *testing.T) {
	tests := []struct {
		name string
		row  []any
		want Column
	}{
		{
			name: "primary key column",
			row:  []any{"id", "INT", false, "PRI(id)", nil, nil},
			want: Column{Name: "id", Type: "INT", Nullable: false, PrimaryKey: true},
		},
		{
			name: "nullable plain column",
			row:  []any{"amount", "DECIMAL(10, 2)", true, nil, nil, nil},
			want: Column{Name: "amount", Type: "DECIMAL(10, 2)", Nullable: true},
		},
		{
			name: "rowtime column carries watermark, drops *ROWTIME* marker",
			row: []any{
				"event_time", "TIMESTAMP(3) *ROWTIME*", true, nil, nil,
				"`event_time` - INTERVAL '5' SECOND",
			},
			want: Column{
				Name: "event_time", Type: "TIMESTAMP(3)", Nullable: true,
				Watermark: "`event_time` - INTERVAL '5' SECOND",
			},
		},
		{
			name: "short row (name+type only) is tolerated",
			row:  []any{"note", "STRING"},
			want: Column{Name: "note", Type: "STRING", Nullable: true},
		},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := parseColumnRow(tt.row); got != tt.want {
				t.Errorf("parseColumnRow(%v) = %+v, want %+v", tt.row, got, tt.want)
			}
		})
	}
}
