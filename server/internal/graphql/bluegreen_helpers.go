package graphql

import (
	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/k8s"
)

func mapBlueGreenDeployment(d *k8s.BlueGreenDeployment) *model.BlueGreenDeployment {
	state := mapBlueGreenState(d.State)
	result := &model.BlueGreenDeployment{
		Name:      d.Name,
		Namespace: d.Namespace,
		State:     state,
	}

	if d.JobStatus != "" {
		result.JobStatus = &d.JobStatus
	}
	if d.Error != "" {
		result.Error = &d.Error
	}
	if d.LastReconciledTimestamp != "" {
		result.LastReconciledTimestamp = &d.LastReconciledTimestamp
	}
	if d.AbortTimestamp != "" {
		result.AbortTimestamp = &d.AbortTimestamp
	}
	if d.DeploymentReadyTimestamp != "" {
		result.DeploymentReadyTimestamp = &d.DeploymentReadyTimestamp
	}
	if d.BlueDeploymentName != "" {
		result.BlueDeploymentName = &d.BlueDeploymentName
	}
	if d.GreenDeploymentName != "" {
		result.GreenDeploymentName = &d.GreenDeploymentName
	}
	if d.ActiveJobID != "" {
		result.ActiveJobID = &d.ActiveJobID
	}
	if d.PendingJobID != "" {
		result.PendingJobID = &d.PendingJobID
	}
	if d.AbortGracePeriod != "" {
		result.AbortGracePeriod = &d.AbortGracePeriod
	}
	if d.DeploymentDeletionDelay != "" {
		result.DeploymentDeletionDelay = &d.DeploymentDeletionDelay
	}

	return result
}

func mapBlueGreenState(state k8s.BlueGreenState) model.BlueGreenState {
	switch state {
	case k8s.StateInitializingBlue:
		return model.BlueGreenStateInitializingBlue
	case k8s.StateActiveBlue:
		return model.BlueGreenStateActiveBlue
	case k8s.StateActiveGreen:
		return model.BlueGreenStateActiveGreen
	case k8s.StateSavepointingBlue:
		return model.BlueGreenStateSavepointingBlue
	case k8s.StateSavepointingGreen:
		return model.BlueGreenStateSavepointingGreen
	case k8s.StateTransitioningBlue:
		return model.BlueGreenStateTransitioningToBlue
	case k8s.StateTransitioningGreen:
		return model.BlueGreenStateTransitioningToGreen
	default:
		return model.BlueGreenStateInitializingBlue
	}
}
