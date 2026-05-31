package sync

import "testing"

func TestCategorizeRestoreFailure(t *testing.T) {
	tests := []struct {
		name         string
		text         string
		wantCategory string
		wantIsFail   bool
	}{
		{
			name:         "max parallelism mismatch",
			text:         "java.lang.IllegalStateException: The maximum parallelism (128) with which the latest checkpoint was taken does not match the configured maximum parallelism (256).",
			wantCategory: RestoreCatMaxParallelism,
			wantIsFail:   true,
		},
		{
			name:         "key group range",
			text:         "Cannot restore: the number of key groups changed",
			wantCategory: RestoreCatMaxParallelism,
			wantIsFail:   true,
		},
		{
			name:         "unmapped operator state",
			text:         "java.lang.IllegalStateException: Cannot map checkpoint/savepoint state for operator abc123 to the new program, because the operator is not available in the new program.",
			wantCategory: RestoreCatUnmappedState,
			wantIsFail:   true,
		},
		{
			name:         "could not be mapped",
			text:         "Failed to rollback: state for operator def could not be mapped to any operator of the new job graph.",
			wantCategory: RestoreCatUnmappedState,
			wantIsFail:   true,
		},
		{
			name:         "allowNonRestoredState hint",
			text:         "...you can allowNonRestoredState to skip the missing state.",
			wantCategory: RestoreCatUnmappedState,
			wantIsFail:   true,
		},
		{
			name:         "missing operator",
			text:         "Cannot find the operator with uid hash 0xff in the new job.",
			wantCategory: RestoreCatMissingOperator,
			wantIsFail:   true,
		},
		{
			name:         "serializer incompatible",
			text:         "The new serializer for the keyed state is not compatible with the old serializer.",
			wantCategory: RestoreCatSerializer,
			wantIsFail:   true,
		},
		{
			name:         "TypeSerializerSchemaCompatibility",
			text:         "TypeSerializerSchemaCompatibility.incompatible() was returned for state 'count'.",
			wantCategory: RestoreCatSerializer,
			wantIsFail:   true,
		},
		{
			name:         "state schema evolution",
			text:         "The state schema is not compatible after evolution of the value type.",
			wantCategory: RestoreCatSchemaEvolution,
			wantIsFail:   true,
		},
		{
			name:         "generic state migration",
			text:         "org.apache.flink.util.StateMigrationException: The state was not migrated.",
			wantCategory: RestoreCatStateMigration,
			wantIsFail:   true,
		},
		{
			name:         "unknown restore failure",
			text:         "Failed to restore from the configured savepoint.",
			wantCategory: RestoreCatUnknown,
			wantIsFail:   true,
		},
		{
			name:       "ordinary NPE is not a restore failure",
			text:       "java.lang.NullPointerException at com.example.MyMapFunction.map(MyMapFunction.java:42)",
			wantIsFail: false,
		},
		{
			name:       "kafka timeout is not a restore failure",
			text:       "org.apache.kafka.common.errors.TimeoutException: Topic not present in metadata after 60000 ms.",
			wantIsFail: false,
		},
		{
			name:       "empty text",
			text:       "",
			wantIsFail: false,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			gotCategory, gotIsFail := CategorizeRestoreFailure(tt.text)
			if gotIsFail != tt.wantIsFail {
				t.Fatalf("isRestoreFailure = %v, want %v (category %q)", gotIsFail, tt.wantIsFail, gotCategory)
			}
			if tt.wantIsFail && gotCategory != tt.wantCategory {
				t.Errorf("category = %q, want %q", gotCategory, tt.wantCategory)
			}
		})
	}
}
