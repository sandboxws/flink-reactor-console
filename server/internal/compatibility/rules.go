package compatibility

import "fmt"

// finalize folds per-operator issues into a verdict. Any error ⇒ INCOMPATIBLE;
// otherwise any warning ⇒ WARNING; otherwise COMPATIBLE. canProceed is true
// unless the verdict is INCOMPATIBLE.
func finalize(issues []Issue) Report {
	verdict := VerdictCompatible
	for _, i := range issues {
		if i.Severity == SeverityError {
			verdict = VerdictIncompatible
			break
		}
		verdict = VerdictWarning
	}
	return Report{
		Verdict:    verdict,
		CanProceed: verdict != VerdictIncompatible,
		Issues:     issues,
	}
}

func removedOperatorIssue(op OperatorState) Issue {
	return Issue{
		OperatorKey: op.LogicalKey,
		Component:   op.Component,
		Category:    "UNMAPPED_STATE",
		Severity:    SeverityError,
		Message: fmt.Sprintf(
			"operator %q was removed; its savepoint state can no longer be mapped (deploy with --allow-non-restored-state to drop it)",
			op.LogicalKey),
	}
}

func newOperatorIssue(op OperatorState) Issue {
	return Issue{
		OperatorKey: op.LogicalKey,
		Component:   op.Component,
		Category:    "SCHEMA_EVOLUTION",
		Severity:    SeverityWarning,
		Message:     fmt.Sprintf("new stateful operator %q will start with empty state", op.LogicalKey),
	}
}

// classify explains why a present-in-both operator's hash changed.
func classify(before, after OperatorState) []Issue {
	var issues []Issue

	if maxParallelismChanged(before, after) {
		issues = append(issues, Issue{
			OperatorKey: after.LogicalKey,
			Component:   after.Component,
			Category:    "MAX_PARALLELISM",
			Severity:    SeverityError,
			Message: fmt.Sprintf(
				"operator %q changed max parallelism; keyed state cannot be remapped on restore",
				after.LogicalKey),
		})
	}

	if before.StateRole != after.StateRole ||
		keyFieldsChanged(before.KeyFields, after.KeyFields) ||
		before.ChangelogMode != after.ChangelogMode {
		issues = append(issues, Issue{
			OperatorKey: after.LogicalKey,
			Component:   after.Component,
			Category:    "SERIALIZER",
			Severity:    SeverityError,
			Message: fmt.Sprintf(
				"operator %q changed its keyed-state key, role, or changelog mode; restoring from the existing savepoint will fail",
				after.LogicalKey),
		})
	}

	if len(issues) == 0 {
		// Hash differs but key/role/changelog/max-parallelism are unchanged: a
		// value/accumulator/option change. Surfaced as advisory — the CLI gate
		// is authoritative and may block some of these (e.g. aggregate
		// accumulator changes under its Balanced policy).
		issues = append(issues, Issue{
			OperatorKey: after.LogicalKey,
			Component:   after.Component,
			Category:    "SCHEMA_EVOLUTION",
			Severity:    SeverityWarning,
			Message: fmt.Sprintf(
				"operator %q changed shape (accumulators/options); verify on a non-production environment before deploying",
				after.LogicalKey),
		})
	}

	return issues
}

// maxParallelismChanged is true only when both sides declare a value and they
// differ — an unknown (nil) max parallelism is never the sole basis for a flag.
func maxParallelismChanged(a, b OperatorState) bool {
	if a.MaxParallelism == nil || b.MaxParallelism == nil {
		return false
	}
	return *a.MaxParallelism != *b.MaxParallelism
}

// keyFieldsChanged reports a restore-breaking key change. A type difference is
// ignored when either side is "UNKNOWN" (un-inferrable), matching the DSL.
func keyFieldsChanged(a, b []KeyField) bool {
	if len(a) != len(b) {
		return true
	}
	for i := range a {
		if a[i].Name != b[i].Name {
			return true
		}
		if a[i].Type != b[i].Type && a[i].Type != "UNKNOWN" && b[i].Type != "UNKNOWN" {
			return true
		}
	}
	return false
}
