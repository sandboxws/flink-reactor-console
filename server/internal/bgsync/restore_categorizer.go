package bgsync

import "regexp"

// Restore-failure categories. These intentionally mirror the static
// compatibility engine's categories (internal/compatibility) so a predicted
// incompatibility and an observed restore failure can be correlated on the
// same axis — the prediction↔reality learning loop. STATE_MIGRATION,
// MISSING_OPERATOR and UNKNOWN are restore-time-only refinements.
const (
	RestoreCatMaxParallelism  = "MAX_PARALLELISM"
	RestoreCatUnmappedState   = "UNMAPPED_STATE"
	RestoreCatMissingOperator = "MISSING_OPERATOR"
	RestoreCatSerializer      = "SERIALIZER"
	RestoreCatSchemaEvolution = "SCHEMA_EVOLUTION"
	RestoreCatStateMigration  = "STATE_MIGRATION"
	RestoreCatUnknown         = "UNKNOWN"
)

// restoreFailurePattern maps an exception-text regex to a category. Order is
// significant: the first match wins, so specific patterns precede general
// ones (e.g. a serializer mismatch surfaced as a StateMigrationException is
// categorized SERIALIZER, not STATE_MIGRATION).
type restoreFailurePattern struct {
	re       *regexp.Regexp
	category string
}

var restoreFailurePatterns = []restoreFailurePattern{
	// Max-parallelism / key-group count mismatch.
	{regexp.MustCompile(`(?i)max(?:imum)?\s+parallelism`), RestoreCatMaxParallelism},
	{regexp.MustCompile(`(?i)number of key.?group`), RestoreCatMaxParallelism},

	// State that cannot be assigned to any operator in the new job graph
	// (topology change, dropped/renamed operator without allowNonRestoredState).
	{regexp.MustCompile(`(?i)cannot map .*state`), RestoreCatUnmappedState},
	{regexp.MustCompile(`(?i)(?:could not|cannot) be mapped to`), RestoreCatUnmappedState},
	{regexp.MustCompile(`(?i)allowNonRestoredState`), RestoreCatUnmappedState},

	// Operator UID present in the snapshot but absent from the new graph.
	{regexp.MustCompile(`(?i)cannot find .*operator`), RestoreCatMissingOperator},
	{regexp.MustCompile(`(?i)operator .*(?:not found|does not exist|is missing)`), RestoreCatMissingOperator},

	// Serializer incompatibility (data-type / serializer change).
	{regexp.MustCompile(`(?i)serializer.*(?:incompatib|not compatible)`), RestoreCatSerializer},
	{regexp.MustCompile(`(?i)(?:incompatib|not compatible).*serializer`), RestoreCatSerializer},
	{regexp.MustCompile(`(?i)TypeSerializerSchemaCompatibility`), RestoreCatSerializer},

	// State-schema evolution that the new serializer rejects.
	{regexp.MustCompile(`(?i)state schema`), RestoreCatSchemaEvolution},
	{regexp.MustCompile(`(?i)schema.*(?:incompatib|not compatible|evolution)`), RestoreCatSchemaEvolution},

	// Generic state migration (less specific than the above).
	{regexp.MustCompile(`StateMigrationException`), RestoreCatStateMigration},

	// Clear restore failure not otherwise categorized.
	{regexp.MustCompile(`(?i)(?:failed to|could not|cannot|unable to)\s+(?:restore|rollback)`), RestoreCatUnknown},
	{regexp.MustCompile(`(?i)error while restoring`), RestoreCatUnknown},
}

// CategorizeRestoreFailure inspects an exception's text (name + stacktrace) and
// classifies it as a state-restore failure. It returns the category and true
// only when the text clearly indicates a restore/state problem; ordinary
// runtime exceptions return ("", false) so they never reach the timeline.
func CategorizeRestoreFailure(text string) (string, bool) {
	for _, p := range restoreFailurePatterns {
		if p.re.MatchString(text) {
			return p.category, true
		}
	}
	return "", false
}
