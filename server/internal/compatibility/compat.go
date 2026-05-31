// Package compatibility compares two pipeline State Manifests (produced by the
// DSL — see the state-collision-01 change) and reports whether a new manifest
// can restore from the prior one's savepoint state.
//
// This is the console's server-side, ADVISORY view used for the UI and audit
// trail. The authoritative deploy gate lives in the CLI, which classifies the
// same manifests locally. Both share the State Manifest contract and key their
// "compatible" decision on the DSL-computed operatorHash; this package maps a
// hash difference to a category for display and may be less strict than the
// CLI for value/accumulator-only changes (documented in classify).
package compatibility

// Severity of a single compatibility issue.
type Severity string

const (
	SeverityWarning Severity = "WARNING"
	SeverityError   Severity = "ERROR"
)

// Verdict is the overall result of comparing two manifests.
type Verdict string

const (
	VerdictCompatible   Verdict = "COMPATIBLE"
	VerdictWarning      Verdict = "WARNING"
	VerdictIncompatible Verdict = "INCOMPATIBLE"
)

// KeyField is one keyed-state key column.
type KeyField struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

// OperatorState mirrors the DSL's per-operator descriptor (state-collision-01).
// `shape` is intentionally omitted: operatorHash already encodes it, and the
// console compares by hash rather than re-parsing shape.
type OperatorState struct {
	LogicalKey     string     `json:"logicalKey"`
	NodeID         string     `json:"nodeId"`
	Component      string     `json:"component"`
	StateRole      string     `json:"stateRole"`
	KeyFields      []KeyField `json:"keyFields"`
	ChangelogMode  string     `json:"changelogMode"`
	TTL            *string    `json:"ttl,omitempty"`
	MaxParallelism *int       `json:"maxParallelism,omitempty"`
	OperatorHash   string     `json:"operatorHash"`
}

// StateManifest mirrors the DSL's whole-pipeline manifest.
type StateManifest struct {
	SchemaVersion int             `json:"schemaVersion"`
	PipelineName  string          `json:"pipelineName"`
	FlinkVersion  string          `json:"flinkVersion"`
	Operators     []OperatorState `json:"operators"`
	Fingerprint   string          `json:"fingerprint"`
}

// Issue is one operator-level finding.
type Issue struct {
	OperatorKey string `json:"operatorKey"`
	Component   string `json:"component"`
	// Category: MAX_PARALLELISM | UNMAPPED_STATE | SERIALIZER | SCHEMA_EVOLUTION
	Category string   `json:"category"`
	Severity Severity `json:"severity"`
	Message  string   `json:"message"`
}

// Report is the full comparison result.
type Report struct {
	Verdict    Verdict `json:"verdict"`
	CanProceed bool    `json:"canProceed"`
	Issues     []Issue `json:"issues"`
}

// Compare diffs a proposed `next` manifest against the prior `old`, matching
// operators by logicalKey. A nil `old` (first deploy) is always compatible.
func Compare(old *StateManifest, next StateManifest) Report {
	if old == nil {
		return Report{Verdict: VerdictCompatible, CanProceed: true, Issues: []Issue{}}
	}

	oldByKey := make(map[string]OperatorState, len(old.Operators))
	for _, op := range old.Operators {
		oldByKey[op.LogicalKey] = op
	}
	nextByKey := make(map[string]OperatorState, len(next.Operators))
	for _, op := range next.Operators {
		nextByKey[op.LogicalKey] = op
	}

	issues := []Issue{}
	for _, op := range next.Operators {
		before, existed := oldByKey[op.LogicalKey]
		switch {
		case !existed:
			issues = append(issues, newOperatorIssue(op))
		case before.OperatorHash == op.OperatorHash:
			// unchanged
		default:
			issues = append(issues, classify(before, op)...)
		}
	}
	for _, op := range old.Operators {
		if _, ok := nextByKey[op.LogicalKey]; !ok {
			issues = append(issues, removedOperatorIssue(op))
		}
	}

	return finalize(issues)
}
