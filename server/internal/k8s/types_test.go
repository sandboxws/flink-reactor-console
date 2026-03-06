package k8s

import (
	"testing"
)

func TestParseBlueGreenDeployment(t *testing.T) {
	data := []byte(`{
		"apiVersion": "flink.apache.org/v1beta1",
		"kind": "FlinkBlueGreenDeployment",
		"metadata": {
			"name": "order-processor",
			"namespace": "flink-ns"
		},
		"spec": {
			"configuration": {
				"blue-green.abort.grace-period": "10m",
				"blue-green.deployment.deletion.delay": "2s"
			}
		},
		"status": {
			"state": "ACTIVE_BLUE",
			"jobStatus": "RUNNING",
			"lastReconciledTimestamp": "2026-03-06T10:00:00Z",
			"blueDeploymentName": "order-processor-blue",
			"greenDeploymentName": "order-processor-green",
			"activeJobId": "abc123",
			"pendingJobId": "def456"
		}
	}`)

	bg, err := ParseBlueGreenDeployment(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if bg.Name != "order-processor" {
		t.Errorf("expected name 'order-processor', got %q", bg.Name)
	}
	if bg.Namespace != "flink-ns" {
		t.Errorf("expected namespace 'flink-ns', got %q", bg.Namespace)
	}
	if bg.State != StateActiveBlue {
		t.Errorf("expected state ACTIVE_BLUE, got %q", bg.State)
	}
	if bg.JobStatus != "RUNNING" {
		t.Errorf("expected jobStatus 'RUNNING', got %q", bg.JobStatus)
	}
	if bg.BlueDeploymentName != "order-processor-blue" {
		t.Errorf("expected blue deployment 'order-processor-blue', got %q", bg.BlueDeploymentName)
	}
	if bg.GreenDeploymentName != "order-processor-green" {
		t.Errorf("expected green deployment 'order-processor-green', got %q", bg.GreenDeploymentName)
	}
	if bg.ActiveJobID != "abc123" {
		t.Errorf("expected activeJobId 'abc123', got %q", bg.ActiveJobID)
	}
	if bg.PendingJobID != "def456" {
		t.Errorf("expected pendingJobId 'def456', got %q", bg.PendingJobID)
	}
	if bg.AbortGracePeriod != "10m" {
		t.Errorf("expected abortGracePeriod '10m', got %q", bg.AbortGracePeriod)
	}
	if bg.DeploymentDeletionDelay != "2s" {
		t.Errorf("expected deploymentDeletionDelay '2s', got %q", bg.DeploymentDeletionDelay)
	}
}

func TestParseBlueGreenDeployment_MinimalStatus(t *testing.T) {
	data := []byte(`{
		"metadata": { "name": "minimal", "namespace": "default" },
		"spec": {},
		"status": { "state": "INITIALIZING_BLUE" }
	}`)

	bg, err := ParseBlueGreenDeployment(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if bg.Name != "minimal" {
		t.Errorf("expected name 'minimal', got %q", bg.Name)
	}
	if bg.State != StateInitializingBlue {
		t.Errorf("expected state INITIALIZING_BLUE, got %q", bg.State)
	}
	if bg.JobStatus != "" {
		t.Errorf("expected empty jobStatus, got %q", bg.JobStatus)
	}
}

func TestParseBlueGreenDeployment_WithError(t *testing.T) {
	data := []byte(`{
		"metadata": { "name": "errored", "namespace": "default" },
		"spec": {},
		"status": {
			"state": "SAVEPOINTING_BLUE",
			"error": "Savepoint timed out after 10m"
		}
	}`)

	bg, err := ParseBlueGreenDeployment(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if bg.Error != "Savepoint timed out after 10m" {
		t.Errorf("expected error message, got %q", bg.Error)
	}
}

func TestParseBlueGreenDeploymentList(t *testing.T) {
	data := []byte(`{
		"items": [
			{
				"metadata": { "name": "bg-1", "namespace": "ns1" },
				"spec": {},
				"status": { "state": "ACTIVE_BLUE" }
			},
			{
				"metadata": { "name": "bg-2", "namespace": "ns1" },
				"spec": {},
				"status": { "state": "TRANSITIONING_TO_GREEN" }
			}
		]
	}`)

	list, err := ParseBlueGreenDeploymentList(data)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(list) != 2 {
		t.Fatalf("expected 2 items, got %d", len(list))
	}
	if list[0].Name != "bg-1" {
		t.Errorf("expected first item 'bg-1', got %q", list[0].Name)
	}
	if list[1].State != StateTransitioningGreen {
		t.Errorf("expected second item state TRANSITIONING_TO_GREEN, got %q", list[1].State)
	}
}

func TestParseBlueGreenDeployment_InvalidJSON(t *testing.T) {
	_, err := ParseBlueGreenDeployment([]byte(`{invalid}`))
	if err == nil {
		t.Error("expected error for invalid JSON")
	}
}
