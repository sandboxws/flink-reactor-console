// Package k8s provides Kubernetes client integration for FlinkBlueGreenDeployment CRDs.
package k8s

import (
	"encoding/json"
	"fmt"
)

// BlueGreenState represents the lifecycle state of a FlinkBlueGreenDeployment.
type BlueGreenState string

// Blue-green lifecycle states as reported by the Flink Kubernetes Operator.
const (
	StateInitializingBlue   BlueGreenState = "INITIALIZING_BLUE"
	StateActiveBlue         BlueGreenState = "ACTIVE_BLUE"
	StateActiveGreen        BlueGreenState = "ACTIVE_GREEN"
	StateSavepointingBlue   BlueGreenState = "SAVEPOINTING_BLUE"
	StateSavepointingGreen  BlueGreenState = "SAVEPOINTING_GREEN"
	StateTransitioningBlue  BlueGreenState = "TRANSITIONING_TO_BLUE"
	StateTransitioningGreen BlueGreenState = "TRANSITIONING_TO_GREEN"
)

// BlueGreenDeployment is the domain model for a FlinkBlueGreenDeployment CRD.
type BlueGreenDeployment struct {
	Name      string         `json:"name"`
	Namespace string         `json:"namespace"`
	State     BlueGreenState `json:"state"`
	JobStatus string         `json:"jobStatus,omitempty"`
	Error     string         `json:"error,omitempty"`

	// Timestamps from status
	LastReconciledTimestamp  string `json:"lastReconciledTimestamp,omitempty"`
	AbortTimestamp           string `json:"abortTimestamp,omitempty"`
	DeploymentReadyTimestamp string `json:"deploymentReadyTimestamp,omitempty"`

	// Child deployment names
	BlueDeploymentName  string `json:"blueDeploymentName,omitempty"`
	GreenDeploymentName string `json:"greenDeploymentName,omitempty"`

	// Configuration
	AbortGracePeriod        string `json:"abortGracePeriod,omitempty"`
	DeploymentDeletionDelay string `json:"deploymentDeletionDelay,omitempty"`

	// Resolved job IDs from child FlinkDeployments
	ActiveJobID  string `json:"activeJobId,omitempty"`
	PendingJobID string `json:"pendingJobId,omitempty"`
}

// crdStatus is the status block of a FlinkBlueGreenDeployment CRD (for JSON parsing).
type crdStatus struct {
	State                    string `json:"state"`
	JobStatus                string `json:"jobStatus"`
	Error                    string `json:"error"`
	LastReconciledTimestamp  string `json:"lastReconciledTimestamp"`
	AbortTimestamp           string `json:"abortTimestamp"`
	DeploymentReadyTimestamp string `json:"deploymentReadyTimestamp"`
	BlueDeploymentName       string `json:"blueDeploymentName"`
	GreenDeploymentName      string `json:"greenDeploymentName"`
	ActiveJobID              string `json:"activeJobId"`
	PendingJobID             string `json:"pendingJobId"`
}

// crdSpec is the spec block of a FlinkBlueGreenDeployment CRD (for JSON parsing).
type crdSpec struct {
	Configuration map[string]string `json:"configuration"`
}

// crdResource is the top-level structure for JSON unmarshaling of the CRD.
type crdResource struct {
	Metadata struct {
		Name      string `json:"name"`
		Namespace string `json:"namespace"`
	} `json:"metadata"`
	Spec   crdSpec   `json:"spec"`
	Status crdStatus `json:"status"`
}

// ParseBlueGreenDeployment converts raw JSON bytes from the K8s API into a BlueGreenDeployment.
func ParseBlueGreenDeployment(data []byte) (*BlueGreenDeployment, error) {
	var raw crdResource
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parsing FlinkBlueGreenDeployment: %w", err)
	}

	bg := &BlueGreenDeployment{
		Name:                     raw.Metadata.Name,
		Namespace:                raw.Metadata.Namespace,
		State:                    BlueGreenState(raw.Status.State),
		JobStatus:                raw.Status.JobStatus,
		Error:                    raw.Status.Error,
		LastReconciledTimestamp:  raw.Status.LastReconciledTimestamp,
		AbortTimestamp:           raw.Status.AbortTimestamp,
		DeploymentReadyTimestamp: raw.Status.DeploymentReadyTimestamp,
		BlueDeploymentName:       raw.Status.BlueDeploymentName,
		GreenDeploymentName:      raw.Status.GreenDeploymentName,
		ActiveJobID:              raw.Status.ActiveJobID,
		PendingJobID:             raw.Status.PendingJobID,
	}

	// Extract BG operator config
	if raw.Spec.Configuration != nil {
		bg.AbortGracePeriod = raw.Spec.Configuration["blue-green.abort.grace-period"]
		bg.DeploymentDeletionDelay = raw.Spec.Configuration["blue-green.deployment.deletion.delay"]
	}

	return bg, nil
}

// ParseBlueGreenDeploymentList converts raw JSON bytes from a K8s list response.
func ParseBlueGreenDeploymentList(data []byte) ([]BlueGreenDeployment, error) {
	var raw struct {
		Items []json.RawMessage `json:"items"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, fmt.Errorf("parsing FlinkBlueGreenDeployment list: %w", err)
	}

	result := make([]BlueGreenDeployment, 0, len(raw.Items))
	for _, item := range raw.Items {
		bg, err := ParseBlueGreenDeployment(item)
		if err != nil {
			return nil, err
		}
		result = append(result, *bg)
	}
	return result, nil
}
