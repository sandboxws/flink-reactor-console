package compatibility

import "testing"

func mp(n int) *int { return &n }

func op(key, role string, keys []KeyField, hash string) OperatorState {
	return OperatorState{
		LogicalKey:    key,
		Component:     "Aggregate",
		StateRole:     role,
		KeyFields:     keys,
		ChangelogMode: "retract",
		OperatorHash:  hash,
	}
}

func manifest(ops ...OperatorState) StateManifest {
	return StateManifest{PipelineName: "p", Operators: ops, Fingerprint: "fp"}
}

var userKey = []KeyField{{Name: "user_id", Type: "STRING"}}

func TestCompare(t *testing.T) {
	tests := []struct {
		name       string
		old        *StateManifest
		next       StateManifest
		verdict    Verdict
		canProceed bool
		category   string // expected category of the first issue, "" if none
	}{
		{
			name:       "first deploy (nil old) is compatible",
			old:        nil,
			next:       manifest(op("agg#0", "keyed-agg", userKey, "h1")),
			verdict:    VerdictCompatible,
			canProceed: true,
		},
		{
			name:       "identical manifest is compatible",
			old:        ptr(manifest(op("agg#0", "keyed-agg", userKey, "h1"))),
			next:       manifest(op("agg#0", "keyed-agg", userKey, "h1")),
			verdict:    VerdictCompatible,
			canProceed: true,
		},
		{
			name:       "removed operator is incompatible (UNMAPPED_STATE)",
			old:        ptr(manifest(op("agg#0", "keyed-agg", userKey, "h1"))),
			next:       manifest(),
			verdict:    VerdictIncompatible,
			canProceed: false,
			category:   "UNMAPPED_STATE",
		},
		{
			name: "key type change is incompatible (SERIALIZER)",
			old:  ptr(manifest(op("agg#0", "keyed-agg", userKey, "h1"))),
			next: manifest(op("agg#0", "keyed-agg",
				[]KeyField{{Name: "user_id", Type: "BIGINT"}}, "h2")),
			verdict:    VerdictIncompatible,
			canProceed: false,
			category:   "SERIALIZER",
		},
		{
			name: "max parallelism change is incompatible (MAX_PARALLELISM)",
			old: ptr(manifest(OperatorState{
				LogicalKey: "agg#0", Component: "Aggregate", StateRole: "keyed-agg",
				KeyFields: userKey, ChangelogMode: "retract",
				MaxParallelism: mp(128), OperatorHash: "h1",
			})),
			next: manifest(OperatorState{
				LogicalKey: "agg#0", Component: "Aggregate", StateRole: "keyed-agg",
				KeyFields: userKey, ChangelogMode: "retract",
				MaxParallelism: mp(256), OperatorHash: "h2",
			}),
			verdict:    VerdictIncompatible,
			canProceed: false,
			category:   "MAX_PARALLELISM",
		},
		{
			name:       "accumulator-only change is an advisory warning (SCHEMA_EVOLUTION)",
			old:        ptr(manifest(op("agg#0", "keyed-agg", userKey, "h1"))),
			next:       manifest(op("agg#0", "keyed-agg", userKey, "h2")),
			verdict:    VerdictWarning,
			canProceed: true,
			category:   "SCHEMA_EVOLUTION",
		},
		{
			name:       "new operator is a warning (SCHEMA_EVOLUTION)",
			old:        ptr(manifest(op("agg#0", "keyed-agg", userKey, "h1"))),
			next:       manifest(op("agg#0", "keyed-agg", userKey, "h1"), op("join#0", "join", nil, "h3")),
			verdict:    VerdictWarning,
			canProceed: true,
			category:   "SCHEMA_EVOLUTION",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := Compare(tt.old, tt.next)
			if got.Verdict != tt.verdict {
				t.Errorf("verdict = %q, want %q", got.Verdict, tt.verdict)
			}
			if got.CanProceed != tt.canProceed {
				t.Errorf("canProceed = %v, want %v", got.CanProceed, tt.canProceed)
			}
			if tt.category != "" {
				if len(got.Issues) == 0 {
					t.Fatalf("expected an issue with category %q, got none", tt.category)
				}
				if got.Issues[0].Category != tt.category {
					t.Errorf("first issue category = %q, want %q", got.Issues[0].Category, tt.category)
				}
			}
		})
	}
}

func ptr(m StateManifest) *StateManifest { return &m }
