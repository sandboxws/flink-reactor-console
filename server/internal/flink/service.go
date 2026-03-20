package flink

import (
	"context"
	"fmt"
	"io"
)

// JarRunRequest holds parameters for running a JAR.
type JarRunRequest struct {
	EntryClass       string `json:"entryClass,omitempty"`
	ProgramArgs      string `json:"programArgs,omitempty"`
	Parallelism      *int   `json:"parallelism,omitempty"`
	SavepointPath    string `json:"savepointPath,omitempty"`
	AllowNonRestored bool   `json:"allowNonRestoredState,omitempty"`
}

// Service provides domain-level operations on a Flink cluster.
// Simple operations delegate directly to the Client; complex aggregated
// operations delegate to the Aggregator.
type Service struct {
	client     *Client
	aggregator *Aggregator
}

// NewService creates a Service backed by the given Flink client.
func NewService(client *Client) *Service {
	return &Service{
		client:     client,
		aggregator: NewAggregator(client),
	}
}

// Client returns the underlying Flink HTTP client for direct access
// to endpoints not wrapped by the service layer (e.g., logs, thread dumps).
func (s *Service) Client() *Client {
	return s.client
}

// --- Simple pass-through methods ---

// GetClusterOverview returns the Flink cluster overview.
func (s *Service) GetClusterOverview(ctx context.Context) (*ClusterOverview, error) {
	var result ClusterOverview
	if err := s.client.GetJSON(ctx, "/overview", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetJobs returns the overview of all jobs.
func (s *Service) GetJobs(ctx context.Context) (*JobsOverview, error) {
	var result JobsOverview
	if err := s.client.GetJSON(ctx, "/jobs/overview", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// CancelJob cancels a running job by ID.
func (s *Service) CancelJob(ctx context.Context, jobID string) error {
	return s.client.Patch(ctx, fmt.Sprintf("/jobs/%s", jobID), nil)
}

// GetTaskManagers returns the list of task managers.
func (s *Service) GetTaskManagers(ctx context.Context) (*TaskManagerList, error) {
	var result TaskManagerList
	if err := s.client.GetJSON(ctx, "/taskmanagers", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetJars returns the list of uploaded JARs.
func (s *Service) GetJars(ctx context.Context) (*JarList, error) {
	var result JarList
	if err := s.client.GetJSON(ctx, "/jars", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// DeleteJar deletes an uploaded JAR by ID.
func (s *Service) DeleteJar(ctx context.Context, jarID string) error {
	return s.client.Delete(ctx, fmt.Sprintf("/jars/%s", jarID))
}

// RunJar runs a JAR with optional parameters.
func (s *Service) RunJar(ctx context.Context, jarID string, opts *JarRunRequest) (*JarRunResponse, error) {
	var result JarRunResponse
	if err := s.client.PostJSON(ctx, fmt.Sprintf("/jars/%s/run", jarID), opts, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// UploadJar uploads a JAR file via multipart form.
func (s *Service) UploadJar(ctx context.Context, reader io.Reader, contentType string) (*JarUploadResponse, error) {
	var result JarUploadResponse
	if err := s.client.PostForm(ctx, "/jars/upload", reader, contentType, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetJobManagerConfig returns the job manager configuration.
func (s *Service) GetJobManagerConfig(ctx context.Context) (JMConfig, error) {
	var result JMConfig
	if err := s.client.GetJSON(ctx, "/jobmanager/config", &result); err != nil {
		return nil, err
	}
	return result, nil
}

// GetJobManagerEnvironment returns the job manager environment.
func (s *Service) GetJobManagerEnvironment(ctx context.Context) (*JMEnvironment, error) {
	var result JMEnvironment
	if err := s.client.GetJSON(ctx, "/jobmanager/environment", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetFlinkConfig returns the Flink cluster configuration.
func (s *Service) GetFlinkConfig(ctx context.Context) (*ClusterConfig, error) {
	var result ClusterConfig
	if err := s.client.GetJSON(ctx, "/config", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// --- Job lifecycle methods ---

// TriggerSavepoint triggers a savepoint for a running job.
// If targetDir is empty, Flink uses its configured default savepoint directory.
func (s *Service) TriggerSavepoint(ctx context.Context, jobID string, targetDir string) (string, error) {
	req := SavepointTriggerRequest{CancelJob: false}
	if targetDir != "" {
		req.TargetDirectory = &targetDir
	}
	var resp SavepointTriggerResponse
	if err := s.client.PostJSON(ctx, fmt.Sprintf("/jobs/%s/savepoints", jobID), req, &resp); err != nil {
		return "", err
	}
	return resp.RequestID, nil
}

// StopWithSavepoint stops a job gracefully by taking a savepoint first.
// If targetDir is empty, Flink uses its configured default savepoint directory.
func (s *Service) StopWithSavepoint(ctx context.Context, jobID string, targetDir string) (string, error) {
	req := StopWithSavepointRequest{Drain: false}
	if targetDir != "" {
		req.TargetDirectory = &targetDir
	}
	var resp SavepointTriggerResponse
	if err := s.client.PostJSON(ctx, fmt.Sprintf("/jobs/%s/stop", jobID), req, &resp); err != nil {
		return "", err
	}
	return resp.RequestID, nil
}

// RescaleJob rescales a running job to the given parallelism.
func (s *Service) RescaleJob(ctx context.Context, jobID string, newParallelism int) (string, error) {
	var resp RescaleResponse
	if err := s.client.PostJSON(ctx, fmt.Sprintf("/jobs/%s/rescaling", jobID), RescaleRequest{Parallelism: newParallelism}, &resp); err != nil {
		return "", err
	}
	return resp.RequestID, nil
}

// --- Aggregated methods ---

// GetJobDetail returns a fully aggregated job detail.
func (s *Service) GetJobDetail(ctx context.Context, jobID string) (*JobDetailAggregate, error) {
	return s.aggregator.JobDetail(ctx, jobID)
}

// GetTaskManagerDetail returns aggregated TM detail with metrics.
func (s *Service) GetTaskManagerDetail(ctx context.Context, tmID string) (*TMDetailAggregate, error) {
	return s.aggregator.TMDetail(ctx, tmID)
}

// GetJobManager returns aggregated JM detail with metrics.
func (s *Service) GetJobManager(ctx context.Context) (*JMDetailAggregate, error) {
	return s.aggregator.JMDetail(ctx)
}

// --- Metric fetch methods ---

// GetJobManagerMetrics returns JM metrics for the pre-defined metric set.
func (s *Service) GetJobManagerMetrics(ctx context.Context) ([]MetricItem, error) {
	var metrics []MetricItem
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobmanager/metrics?get=%s", JMMetricQuery), &metrics); err != nil {
		return nil, err
	}
	return metrics, nil
}

// GetTaskManagerMetrics returns TM metrics for the pre-defined metric set.
func (s *Service) GetTaskManagerMetrics(ctx context.Context, tmID string) ([]MetricItem, error) {
	var metrics []MetricItem
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/taskmanagers/%s/metrics?get=%s", tmID, TMMetricQuery), &metrics); err != nil {
		return nil, err
	}
	return metrics, nil
}

// GetVertexMetrics returns vertex metrics for the pre-defined metric set.
func (s *Service) GetVertexMetrics(ctx context.Context, jobID, vertexID string) ([]MetricItem, error) {
	var metrics []MetricItem
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s/metrics?get=%s", jobID, vertexID, VertexMetricQuery), &metrics); err != nil {
		return nil, err
	}
	return metrics, nil
}

// --- Direct vertex-level methods ---

// GetCheckpointDetail returns checkpoint detail for a specific checkpoint.
func (s *Service) GetCheckpointDetail(ctx context.Context, jobID string, cpID int64) (*CheckpointDetail, error) {
	var result CheckpointDetail
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/checkpoints/details/%d", jobID, cpID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCheckpointSubtasks returns per-vertex checkpoint stats for a specific checkpoint.
func (s *Service) GetCheckpointSubtasks(ctx context.Context, jobID string, cpID int64, vertexID string) (*CheckpointTaskStats, error) {
	var result CheckpointTaskStats
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/checkpoints/details/%d/subtasks/%s", jobID, cpID, vertexID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetCheckpointStats returns checkpoint statistics for a job.
func (s *Service) GetCheckpointStats(ctx context.Context, jobID string) (*CheckpointStats, error) {
	var result CheckpointStats
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/checkpoints", jobID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetJobExceptions returns the exception history for a job.
func (s *Service) GetJobExceptions(ctx context.Context, jobID string) (*JobExceptions, error) {
	var result JobExceptions
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/exceptions?maxExceptions=100", jobID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetVertexDetail returns the vertex detail for a specific vertex.
func (s *Service) GetVertexDetail(ctx context.Context, jobID string, vertexID string) (*VertexDetail, error) {
	var result VertexDetail
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s", jobID, vertexID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetVertexFlamegraph returns the flamegraph for a vertex.
func (s *Service) GetVertexFlamegraph(ctx context.Context, jobID string, vertexID string, fgType string) (*Flamegraph, error) {
	var result Flamegraph
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s/flamegraph?type=%s", jobID, vertexID, fgType), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// GetSubtaskTimes returns per-subtask timing data for a vertex.
func (s *Service) GetSubtaskTimes(ctx context.Context, jobID string, vertexID string) (*SubtaskTimes, error) {
	var result SubtaskTimes
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/vertices/%s/subtasktimes", jobID, vertexID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}
