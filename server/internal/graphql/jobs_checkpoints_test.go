package graphql_test

import (
	"context"
	"strings"
	"testing"
)

func TestCheckpointDetail_CompletedCarriesPathAndTasks(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	got, err := queryResolver(resolver).CheckpointDetail(context.Background(), "job-1", "3", nil)
	if err != nil {
		t.Fatalf("CheckpointDetail() error: %v", err)
	}
	if got.ID != "3" {
		t.Errorf("expected id \"3\", got %q", got.ID)
	}
	if got.Status != "COMPLETED" {
		t.Errorf("expected status COMPLETED, got %q", got.Status)
	}
	if got.ExternalPath == nil || *got.ExternalPath != "s3://flink/checkpoints/mock/chk-3" {
		t.Errorf("expected external path for completed checkpoint, got %v", got.ExternalPath)
	}
	if got.FailureMessage != nil {
		t.Errorf("expected nil failureMessage on completed checkpoint, got %q", *got.FailureMessage)
	}
	if got.CheckpointType == nil || *got.CheckpointType != "CHECKPOINT" {
		t.Errorf("expected checkpointType CHECKPOINT, got %v", got.CheckpointType)
	}

	if len(got.Tasks) != 2 {
		t.Fatalf("expected 2 tasks, got %d", len(got.Tasks))
	}
	// Spec: tasks sorted by vertex ID for stable ordering.
	if got.Tasks[0].VertexID != "vertex-sink-2" || got.Tasks[1].VertexID != "vertex-source-1" {
		t.Errorf("expected tasks sorted by vertex ID, got [%q, %q]",
			got.Tasks[0].VertexID, got.Tasks[1].VertexID)
	}
	if got.Tasks[1].StateSize != "800000" {
		t.Errorf("expected source task stateSize \"800000\", got %q", got.Tasks[1].StateSize)
	}
	if got.Tasks[1].NumAcknowledgedSubtasks != 8 {
		t.Errorf("expected 8 acked subtasks, got %d", got.Tasks[1].NumAcknowledgedSubtasks)
	}
}

func TestCheckpointDetail_FailedCarriesFailureMessage(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	got, err := queryResolver(resolver).CheckpointDetail(context.Background(), "job-1", "8", nil)
	if err != nil {
		t.Fatalf("CheckpointDetail() error: %v", err)
	}
	if got.Status != "FAILED" {
		t.Errorf("expected status FAILED, got %q", got.Status)
	}
	if got.FailureMessage == nil || !strings.Contains(*got.FailureMessage, "Checkpoint expired") {
		t.Errorf("expected failure message on failed checkpoint, got %v", got.FailureMessage)
	}
	if got.FailureTimestamp == nil {
		t.Error("expected failureTimestamp on failed checkpoint, got nil")
	}
	if got.ExternalPath != nil {
		t.Errorf("expected nil externalPath on failed checkpoint, got %q", *got.ExternalPath)
	}
}

func TestCheckpointSubtasks_MapsSummaryAndSparseEntries(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	got, err := queryResolver(resolver).CheckpointSubtasks(
		context.Background(), "job-1", "5", "vertex-source-1", nil,
	)
	if err != nil {
		t.Fatalf("CheckpointSubtasks() error: %v", err)
	}
	if got.VertexID != "vertex-source-1" {
		t.Errorf("expected vertexId echoed from request, got %q", got.VertexID)
	}

	if got.Summary == nil {
		t.Fatal("expected summary, got nil")
	}
	if got.Summary.SyncDuration == nil || got.Summary.SyncDuration.Avg != "150" {
		t.Errorf("expected syncDuration avg \"150\", got %v", got.Summary.SyncDuration)
	}
	if got.Summary.AsyncDuration == nil || got.Summary.AsyncDuration.Max != "1000" {
		t.Errorf("expected asyncDuration max \"1000\", got %v", got.Summary.AsyncDuration)
	}
	if got.Summary.AlignmentDuration == nil || got.Summary.AlignmentDuration.Max != "80" {
		t.Errorf("expected alignmentDuration max \"80\", got %v", got.Summary.AlignmentDuration)
	}
	if got.Summary.StartDelay == nil || got.Summary.StartDelay.Min != "20" {
		t.Errorf("expected startDelay min \"20\", got %v", got.Summary.StartDelay)
	}

	if len(got.Subtasks) != 4 {
		t.Fatalf("expected 4 subtasks, got %d", len(got.Subtasks))
	}
	first := got.Subtasks[0]
	if first.SyncDuration == nil || *first.SyncDuration != "100" {
		t.Errorf("expected subtask 0 syncDuration \"100\", got %v", first.SyncDuration)
	}
	if first.AsyncDuration == nil || *first.AsyncDuration != "800" {
		t.Errorf("expected subtask 0 asyncDuration \"800\", got %v", first.AsyncDuration)
	}
	if first.AlignmentDuration == nil || *first.AlignmentDuration != "40" {
		t.Errorf("expected subtask 0 alignmentDuration \"40\", got %v", first.AlignmentDuration)
	}
	if first.StartDelay == nil || *first.StartDelay != "20" {
		t.Errorf("expected subtask 0 startDelay \"20\", got %v", first.StartDelay)
	}

	// Spec: unacknowledged subtasks carry only index/status — every optional
	// field must stay nil rather than defaulting to zero values.
	sparse := got.Subtasks[3]
	if sparse.Status != "pending_or_failed" {
		t.Errorf("expected sparse subtask status pending_or_failed, got %q", sparse.Status)
	}
	if sparse.AckTimestamp != nil || sparse.SyncDuration != nil || sparse.AlignmentDuration != nil {
		t.Error("expected sparse subtask optional fields to be nil")
	}
}

func TestJobDetail_ChecksFailureFieldsAndConfigExtras(t *testing.T) {
	t.Parallel()
	resolver, cleanup := setupResolver(t)
	defer cleanup()

	got, err := queryResolver(resolver).Job(context.Background(), "job-1", nil)
	if err != nil {
		t.Fatalf("Job() error: %v", err)
	}
	if got.Checkpoints == nil {
		t.Fatal("expected checkpoints on job detail")
	}

	history := got.Checkpoints.History
	if len(history) != 10 {
		t.Fatalf("expected 10 history entries, got %d", len(history))
	}
	failed := history[7]
	if failed.Status != "FAILED" {
		t.Fatalf("expected history[7] FAILED, got %q", failed.Status)
	}
	if failed.FailureMessage == nil || !strings.Contains(*failed.FailureMessage, "Checkpoint expired") {
		t.Errorf("expected failure message on failed history entry, got %v", failed.FailureMessage)
	}
	completed := history[9]
	if completed.ExternalPath == nil || *completed.ExternalPath != "s3://flink/checkpoints/mock/chk-10" {
		t.Errorf("expected external path on completed history entry, got %v", completed.ExternalPath)
	}

	if got.Checkpoints.Latest == nil || got.Checkpoints.Latest.Restored == nil {
		t.Fatal("expected latest.restored")
	}
	if got.Checkpoints.Latest.Restored.ExternalPath == nil {
		t.Error("expected external path on latest.restored")
	}

	cfg := got.CheckpointConfig
	if cfg == nil {
		t.Fatal("expected checkpointConfig on job detail")
	}
	if cfg.StateBackend == nil || *cfg.StateBackend != "HashMapStateBackend" {
		t.Errorf("expected stateBackend HashMapStateBackend, got %v", cfg.StateBackend)
	}
	if cfg.CheckpointStorage == nil || *cfg.CheckpointStorage != "FileSystemCheckpointStorage" {
		t.Errorf("expected checkpointStorage FileSystemCheckpointStorage, got %v", cfg.CheckpointStorage)
	}
	if cfg.TolerableFailedCheckpoints == nil || *cfg.TolerableFailedCheckpoints != 0 {
		t.Errorf("expected tolerableFailedCheckpoints 0, got %v", cfg.TolerableFailedCheckpoints)
	}
	if cfg.CheckpointsAfterTasksFinish == nil || !*cfg.CheckpointsAfterTasksFinish {
		t.Errorf("expected checkpointsAfterTasksFinish true, got %v", cfg.CheckpointsAfterTasksFinish)
	}
}
