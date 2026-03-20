package graphql

import (
	"strconv"

	"github.com/sandboxws/flink-reactor/apps/server/internal/graphql/model"
	"github.com/sandboxws/flink-reactor/apps/server/internal/simulation"
)

// mapSimulationRun converts a domain SimulationRun to a GraphQL model.
func mapSimulationRun(run *simulation.SimulationRun) *model.SimulationRun {
	result := &model.SimulationRun{
		ID:         strconv.FormatInt(run.ID, 10),
		Scenario:   run.Scenario,
		Status:     model.SimulationStatus(run.Status),
		StartedAt:  run.StartedAt.Format("2006-01-02T15:04:05Z07:00"),
		Parameters: run.Parameters,
	}

	if run.StoppedAt != nil {
		s := run.StoppedAt.Format("2006-01-02T15:04:05Z07:00")
		result.StoppedAt = &s
	}

	observations := make([]*model.SimulationObservation, len(run.Observations))
	for i, obs := range run.Observations {
		o := &model.SimulationObservation{
			Timestamp: obs.CapturedAt.Format("2006-01-02T15:04:05Z07:00"),
			Metric:    obs.Metric,
			Value:     obs.Value,
		}
		if obs.Annotation != "" {
			o.Annotation = &obs.Annotation
		}
		observations[i] = o
	}
	result.Observations = observations

	return result
}
