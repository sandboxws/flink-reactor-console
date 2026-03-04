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

// GetFlinkConfig returns the Flink cluster configuration.
func (s *Service) GetFlinkConfig(ctx context.Context) (*ClusterConfig, error) {
	var result ClusterConfig
	if err := s.client.GetJSON(ctx, "/config", &result); err != nil {
		return nil, err
	}
	return &result, nil
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
