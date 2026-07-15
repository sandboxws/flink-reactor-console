package graphql_test

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/sandboxws/flink-reactor-console/server/internal/cluster"
	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor-console/server/internal/savepoints"
)

// savepointsMockResponse returns a fake Flink savepoints listing with one
// completed, one in-progress, and one failed entry. Used to drive resolver
// tests below.
func savepointsMockResponse() flink.SavepointList {
	return flink.SavepointList{
		Operations: []flink.SavepointInfo{
			{
				OperationID:      "sp-completed",
				Status:           flink.SavepointOperationStatus{ID: "COMPLETED"},
				Operation:        flink.SavepointOperationDetail{Location: "s3://bucket/sp-completed"},
				TriggerTimestamp: 1_700_000_000_000,
				SizeBytes:        1024,
				DurationMs:       250,
			},
			{
				OperationID:      "sp-in-progress",
				Status:           flink.SavepointOperationStatus{ID: "IN_PROGRESS"},
				TriggerTimestamp: 1_700_000_300_000,
			},
			{
				OperationID:      "sp-failed",
				Status:           flink.SavepointOperationStatus{ID: "COMPLETED"},
				Operation:        flink.SavepointOperationDetail{FailureCause: "disk full"},
				TriggerTimestamp: 1_700_000_100_000,
			},
		},
	}
}

func savepointsMockServer(t *testing.T, jobID string) *httptest.Server {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("GET /jobs/"+jobID+"/savepoints", func(w http.ResponseWriter, _ *http.Request) {
		writeJobsTestJSON(w, savepointsMockResponse())
	})
	return httptest.NewServer(mux)
}

func setupSavepointResolver(t *testing.T, srv *httptest.Server) *graphql.Resolver {
	t.Helper()
	mgr := &cluster.Manager{}
	if err := mgr.Init([]cluster.Config{
		{Name: "default", URL: srv.URL, Default: true},
	}, testLogger()); err != nil {
		t.Fatalf("cluster manager init: %v", err)
	}
	return &graphql.Resolver{
		Manager:           mgr,
		SavepointTriggers: savepoints.NewTriggerTypeCache(),
	}
}

func TestSavepoints_ReturnsExpectedShape(t *testing.T) {
	t.Parallel()
	const jobID = "job-abc"
	srv := savepointsMockServer(t, jobID)
	defer srv.Close()
	resolver := setupSavepointResolver(t, srv)

	got, err := queryResolver(resolver).Savepoints(context.Background(), jobID, nil)
	if err != nil {
		t.Fatalf("Savepoints() error: %v", err)
	}
	if len(got) != 3 {
		t.Fatalf("expected 3 savepoints, got %d", len(got))
	}

	// Spec: ordered by triggeredAt descending.
	if got[0].ID != "sp-in-progress" {
		t.Errorf("expected most-recent first to be sp-in-progress, got %q", got[0].ID)
	}
	if got[1].ID != "sp-failed" {
		t.Errorf("expected second to be sp-failed, got %q", got[1].ID)
	}
	if got[2].ID != "sp-completed" {
		t.Errorf("expected oldest to be sp-completed, got %q", got[2].ID)
	}

	completed := findByID(got, "sp-completed")
	if completed == nil {
		t.Fatal("sp-completed missing from result")
	}
	if completed.Status != model.SavepointStatusCompleted {
		t.Errorf("sp-completed: expected status COMPLETED, got %q", completed.Status)
	}
	if completed.Location == nil || *completed.Location != "s3://bucket/sp-completed" {
		t.Errorf("sp-completed: expected location s3 path, got %v", completed.Location)
	}
	if completed.SizeBytes == nil || *completed.SizeBytes != "1024" {
		t.Errorf("sp-completed: expected sizeBytes \"1024\", got %v", completed.SizeBytes)
	}
	if completed.DurationMs == nil || *completed.DurationMs != "250" {
		t.Errorf("sp-completed: expected durationMs \"250\", got %v", completed.DurationMs)
	}
	if completed.TriggeredAt != "1700000000000" {
		t.Errorf("sp-completed: expected triggeredAt epoch ms string, got %q", completed.TriggeredAt)
	}
	// Default trigger type when nothing recorded.
	if completed.TriggerType != model.SavepointTriggerTypeManual {
		t.Errorf("sp-completed: expected default triggerType MANUAL, got %q", completed.TriggerType)
	}

	inProgress := findByID(got, "sp-in-progress")
	if inProgress == nil {
		t.Fatal("sp-in-progress missing from result")
	}
	if inProgress.Status != model.SavepointStatusInProgress {
		t.Errorf("sp-in-progress: expected status IN_PROGRESS, got %q", inProgress.Status)
	}
	if inProgress.Location != nil {
		t.Errorf("sp-in-progress: expected nil location, got %v", *inProgress.Location)
	}
	if inProgress.SizeBytes != nil {
		t.Errorf("sp-in-progress: expected nil sizeBytes, got %v", *inProgress.SizeBytes)
	}
}

func TestSavepoints_FailedEntrySurfacesError(t *testing.T) {
	t.Parallel()
	const jobID = "job-abc"
	srv := savepointsMockServer(t, jobID)
	defer srv.Close()
	resolver := setupSavepointResolver(t, srv)

	got, err := queryResolver(resolver).Savepoints(context.Background(), jobID, nil)
	if err != nil {
		t.Fatalf("Savepoints() error: %v", err)
	}

	failed := findByID(got, "sp-failed")
	if failed == nil {
		t.Fatal("sp-failed missing from result")
	}
	if failed.Status != model.SavepointStatusFailed {
		t.Errorf("sp-failed: expected status FAILED, got %q", failed.Status)
	}
	if failed.Error == nil || *failed.Error != "disk full" {
		t.Errorf("sp-failed: expected error \"disk full\", got %v", failed.Error)
	}
	if failed.Location != nil {
		t.Errorf("sp-failed: expected nil location for failed op, got %v", *failed.Location)
	}
}

func TestSavepoints_TriggerTypeFromCache(t *testing.T) {
	t.Parallel()
	const jobID = "job-abc"
	srv := savepointsMockServer(t, jobID)
	defer srv.Close()
	resolver := setupSavepointResolver(t, srv)

	// Stamp two of the three savepoints with recorded trigger reasons.
	resolver.SavepointTriggers.RecordStopWithSavepoint("default", jobID, "sp-completed")
	resolver.SavepointTriggers.RecordBlueGreen("default", jobID, "sp-in-progress")

	got, err := queryResolver(resolver).Savepoints(context.Background(), jobID, nil)
	if err != nil {
		t.Fatalf("Savepoints() error: %v", err)
	}

	cases := map[string]model.SavepointTriggerType{
		"sp-completed":   model.SavepointTriggerTypeStopWithSavepoint,
		"sp-in-progress": model.SavepointTriggerTypeBlueGreen,
		"sp-failed":      model.SavepointTriggerTypeManual, // default for unrecorded
	}
	for id, want := range cases {
		entry := findByID(got, id)
		if entry == nil {
			t.Errorf("missing %s in result", id)
			continue
		}
		if entry.TriggerType != want {
			t.Errorf("%s: expected triggerType %q, got %q", id, want, entry.TriggerType)
		}
	}
}

func findByID(in []*model.Savepoint, id string) *model.Savepoint {
	for _, sp := range in {
		if sp.ID == id {
			return sp
		}
	}
	return nil
}
