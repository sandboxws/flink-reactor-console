package graphql

import (
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
)

// Task 5.1 — mapFailureLabels returns key-sorted pairs.
func TestMapFailureLabels_SortedByKey(t *testing.T) {
	t.Parallel()

	got := mapFailureLabels(map[string]string{
		"type":     "SYSTEM",
		"enricher": "custom",
		"severity": "high",
	})

	wantKeys := []string{"enricher", "severity", "type"}
	if len(got) != len(wantKeys) {
		t.Fatalf("expected %d labels, got %d", len(wantKeys), len(got))
	}
	for i, k := range wantKeys {
		if got[i].Key != k {
			t.Errorf("label %d: want key %q, got %q", i, k, got[i].Key)
		}
	}
	if got[2].Value != "SYSTEM" {
		t.Errorf("type label: want value SYSTEM, got %q", got[2].Value)
	}
}

// Task 5.1 — empty/nil map maps to a non-nil empty slice (so the GraphQL field
// serializes as [] rather than null, and the UI renders no chips).
func TestMapFailureLabels_EmptyMapReturnsNonNilEmpty(t *testing.T) {
	t.Parallel()

	cases := map[string]map[string]string{
		"nil":   nil,
		"empty": {},
	}
	for name, in := range cases {
		got := mapFailureLabels(in)
		if got == nil {
			t.Errorf("%s: expected non-nil empty slice, got nil", name)
		}
		if len(got) != 0 {
			t.Errorf("%s: expected empty slice, got %d entries", name, len(got))
		}
	}
}

// Task 5.2 — an entry with concurrentExceptions maps them recursively (one
// level deep), and each concurrent entry carries its own failure labels.
func TestMapExceptionEntry_ConcurrentMappedRecursively(t *testing.T) {
	t.Parallel()

	tm := "tm-1"
	e := flink.ExceptionHistoryEntry{
		ExceptionName: "org.apache.flink.runtime.JobException",
		Stacktrace:    "boom",
		Timestamp:     1000,
		FailureLabels: map[string]string{"type": "USER"},
		ConcurrentExceptions: []flink.ExceptionHistoryEntry{
			{
				ExceptionName: "java.lang.OutOfMemoryError",
				Stacktrace:    "heap",
				Timestamp:     1001,
				TaskManagerID: &tm,
				FailureLabels: map[string]string{"type": "SYSTEM"},
			},
		},
	}

	got := mapExceptionEntry(e)

	if got.ExceptionName != e.ExceptionName {
		t.Errorf("name: want %q, got %q", e.ExceptionName, got.ExceptionName)
	}
	if len(got.FailureLabels) != 1 || got.FailureLabels[0].Key != "type" || got.FailureLabels[0].Value != "USER" {
		t.Fatalf("root labels: want [{type USER}], got %+v", got.FailureLabels)
	}
	if len(got.ConcurrentExceptions) != 1 {
		t.Fatalf("expected 1 concurrent exception, got %d", len(got.ConcurrentExceptions))
	}

	c := got.ConcurrentExceptions[0]
	if c.ExceptionName != "java.lang.OutOfMemoryError" {
		t.Errorf("concurrent name: got %q", c.ExceptionName)
	}
	if len(c.FailureLabels) != 1 || c.FailureLabels[0].Value != "SYSTEM" {
		t.Errorf("concurrent labels: want [{type SYSTEM}], got %+v", c.FailureLabels)
	}
	// One level deep: the concurrent entry itself carries no further concurrency,
	// but the field is still a non-nil empty slice.
	if c.ConcurrentExceptions == nil {
		t.Error("concurrent entry: expected non-nil empty ConcurrentExceptions")
	}
	if len(c.ConcurrentExceptions) != 0 {
		t.Errorf("concurrent entry: expected no nested concurrency, got %d", len(c.ConcurrentExceptions))
	}
}

// Task 5.3 — regression: an entry with no labels and no concurrent exceptions
// maps to non-nil empty slices (no nil-panic, no empty chips downstream).
func TestMapExceptionEntry_UnenrichedReturnsEmptySlices(t *testing.T) {
	t.Parallel()

	got := mapExceptionEntry(flink.ExceptionHistoryEntry{
		ExceptionName: "org.apache.flink.runtime.JobException",
		Stacktrace:    "boom",
		Timestamp:     1000,
	})

	if got.FailureLabels == nil {
		t.Error("expected non-nil empty FailureLabels")
	}
	if len(got.FailureLabels) != 0 {
		t.Errorf("expected empty FailureLabels, got %d", len(got.FailureLabels))
	}
	if got.ConcurrentExceptions == nil {
		t.Error("expected non-nil empty ConcurrentExceptions")
	}
	if len(got.ConcurrentExceptions) != 0 {
		t.Errorf("expected empty ConcurrentExceptions, got %d", len(got.ConcurrentExceptions))
	}
}
