package flink

import (
	"context"
	"fmt"
	"io"
	"net/url"
)

// StdioMaxBytes caps the size of stdout/stderr responses to avoid massive
// GraphQL payloads. When the underlying Flink endpoint returns more bytes,
// the response is tail-truncated to the last StdioMaxBytes and prefixed with
// StdioTruncatedPrefix. Operators care about *recent* stdio (what just
// happened before a crash), so tail-truncation preserves the high-value
// content while bounding payload size.
const (
	StdioMaxBytes        = 1 << 20 // 1 MB
	StdioTruncatedPrefix = "... [truncated to last 1MB]\n"
)

// capStdio applies the 1 MB tail cap described above. If the input is at or
// below the cap, it is returned unchanged.
func capStdio(s string) string {
	if len(s) <= StdioMaxBytes {
		return s
	}
	return StdioTruncatedPrefix + s[len(s)-StdioMaxBytes:]
}

// JarRunRequest holds parameters for running a JAR.
//
// Program arguments can be supplied two ways. ProgramArgsList (an array) is the
// form Flink 2.0+ expects; the single tokenized ProgramArgs string is deprecated
// there and unreliable/removed. Callers should populate exactly one — set
// ProgramArgsList for 2.0+, or ProgramArgs for legacy 1.x clusters. Both carry
// omitempty so only the populated field is serialized.
type JarRunRequest struct {
	EntryClass       string   `json:"entryClass,omitempty"`
	ProgramArgs      string   `json:"programArgs,omitempty"`
	ProgramArgsList  []string `json:"programArgsList,omitempty"`
	Parallelism      *int     `json:"parallelism,omitempty"`
	SavepointPath    string   `json:"savepointPath,omitempty"`
	AllowNonRestored bool     `json:"allowNonRestoredState,omitempty"`
}

// Service provides domain-level operations on a Flink cluster.
// Simple operations delegate directly to the Client; complex aggregated
// operations delegate to the Aggregator.
type Service struct {
	client     *Client
	aggregator *Aggregator
	ratesCache *RatesCache
}

// NewService creates a Service backed by the given Flink client.
func NewService(client *Client) *Service {
	return &Service{
		client:     client,
		aggregator: NewAggregator(client),
		ratesCache: NewRatesCache(),
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

// Savepoints lists savepoint operations for a job via
// GET /jobs/:jobID/savepoints. Decoding is tolerant: unknown fields are
// ignored so the call survives minor schema changes across Flink versions.
func (s *Service) Savepoints(ctx context.Context, jobID string) ([]SavepointInfo, error) {
	var result SavepointList
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/savepoints", jobID), &result); err != nil {
		return nil, err
	}
	return result.Operations, nil
}

// SavepointDetail returns a single savepoint operation via
// GET /jobs/:jobID/savepoints/:savepointID.
func (s *Service) SavepointDetail(ctx context.Context, jobID, savepointID string) (*SavepointInfo, error) {
	var result SavepointInfo
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/savepoints/%s", jobID, savepointID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RescaleJob rescales a running job to the given parallelism.
func (s *Service) RescaleJob(ctx context.Context, jobID string, newParallelism int) (string, error) {
	var resp RescaleResponse
	if err := s.client.PostJSON(ctx, fmt.Sprintf("/jobs/%s/rescaling", jobID), RescaleRequest{Parallelism: newParallelism}, &resp); err != nil {
		return "", err
	}
	return resp.RequestID, nil
}

// RescaleHistory lists AdaptiveScheduler rescale events for a job via
// GET /jobs/:jobID/rescales/history (Flink 2.3+, FLIP-495). Decoding is
// tolerant: unknown fields are ignored.
func (s *Service) RescaleHistory(ctx context.Context, jobID string) ([]RescaleEventInfo, error) {
	var result RescaleHistoryList
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/rescales/history", jobID), &result); err != nil {
		return nil, err
	}
	return result.Rescales, nil
}

// RescaleDetail returns a single rescale event via
// GET /jobs/:jobID/rescales/details/:rescaleUUID (Flink 2.3+, FLIP-495).
func (s *Service) RescaleDetail(ctx context.Context, jobID, rescaleUUID string) (*RescaleEventInfo, error) {
	var result RescaleEventInfo
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/rescales/details/%s", jobID, rescaleUUID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RescaleSummary returns aggregate rescale statistics via
// GET /jobs/:jobID/rescales/summary (Flink 2.3+, FLIP-495).
func (s *Service) RescaleSummary(ctx context.Context, jobID string) (*RescaleSummaryInfo, error) {
	var result RescaleSummaryInfo
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/rescales/summary", jobID), &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ApplicationsOverview lists applications via GET /applications/overview
// (Flink 2.3+, FLIP-549). Returns an empty list when the cluster doesn't run
// in application mode (the endpoint 404s), so callers can feature-detect.
func (s *Service) ApplicationsOverview(ctx context.Context) ([]ApplicationOverview, error) {
	var result ApplicationList
	if err := s.client.GetJSON(ctx, "/applications/overview", &result); err != nil {
		if IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return result.Applications, nil
}

// ApplicationDetail returns a single application via GET /applications/:id
// (Flink 2.3+, FLIP-549). Returns nil when the application — or the endpoint —
// is not found.
func (s *Service) ApplicationDetail(ctx context.Context, appID string) (*ApplicationOverview, error) {
	var result ApplicationOverview
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/applications/%s", appID), &result); err != nil {
		if IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return &result, nil
}

// CancelApplication cancels an application and all its jobs via
// POST /applications/:id/cancel (Flink 2.3+, FLIP-549).
func (s *Service) CancelApplication(ctx context.Context, appID string) error {
	return s.client.PostJSON(ctx, fmt.Sprintf("/applications/%s/cancel", appID), nil, nil)
}

// --- Aggregated methods ---

// GetJobDetail returns a fully aggregated job detail.
func (s *Service) GetJobDetail(ctx context.Context, jobID string) (*JobDetailAggregate, error) {
	return s.aggregator.JobDetail(ctx, jobID)
}

// GetJobRates returns the lightweight subset of JobDetail needed to compute
// per-job throughput and watermark lag. The result is served from a short-TTL
// cache (RatesCacheTTL); concurrent calls for the same jobID are coalesced
// into a single Flink REST fan-out.
func (s *Service) GetJobRates(ctx context.Context, jobID string) (*JobDetailAggregate, error) {
	return s.ratesCache.Fetch(ctx, "", jobID, func(ctx context.Context) (*JobDetailAggregate, error) {
		return s.aggregator.JobRates(ctx, jobID)
	})
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

// GetJobMetrics returns job-level reliability metrics (numRestarts,
// fullRestarts, uptime, downtime) for the pre-defined metric set.
func (s *Service) GetJobMetrics(ctx context.Context, jobID string) ([]MetricItem, error) {
	var metrics []MetricItem
	if err := s.client.GetJSON(ctx, fmt.Sprintf("/jobs/%s/metrics?get=%s", jobID, JobMetricQuery), &metrics); err != nil {
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

// GetCheckpointSubtasks returns per-subtask checkpoint stats (summary +
// individual subtasks) for one vertex of a specific checkpoint.
func (s *Service) GetCheckpointSubtasks(ctx context.Context, jobID string, cpID int64, vertexID string) (*CheckpointSubtaskDetail, error) {
	var result CheckpointSubtaskDetail
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

// --- Process stdio (stdout/stderr) ---

// GetJobManagerStdout returns the JM process stdout, capped at StdioMaxBytes.
func (s *Service) GetJobManagerStdout(ctx context.Context) (string, error) {
	body, err := s.client.GetText(ctx, "/jobmanager/stdout")
	if err != nil {
		return "", err
	}
	return capStdio(body), nil
}

// GetJobManagerStderr returns the JM process stderr, capped at StdioMaxBytes.
func (s *Service) GetJobManagerStderr(ctx context.Context) (string, error) {
	body, err := s.client.GetText(ctx, "/jobmanager/stderr")
	if err != nil {
		return "", err
	}
	return capStdio(body), nil
}

// GetTaskManagerStdout returns the TM process stdout for tmID, capped at
// StdioMaxBytes. tmID is URL-encoded so host:port-style identifiers don't
// corrupt the request path.
func (s *Service) GetTaskManagerStdout(ctx context.Context, tmID string) (string, error) {
	body, err := s.client.GetText(ctx, "/taskmanagers/"+url.PathEscape(tmID)+"/stdout")
	if err != nil {
		return "", err
	}
	return capStdio(body), nil
}

// GetTaskManagerStderr returns the TM process stderr for tmID, capped at
// StdioMaxBytes. tmID is URL-encoded.
func (s *Service) GetTaskManagerStderr(ctx context.Context, tmID string) (string, error) {
	body, err := s.client.GetText(ctx, "/taskmanagers/"+url.PathEscape(tmID)+"/stderr")
	if err != nil {
		return "", err
	}
	return capStdio(body), nil
}

// --- Async profiler (FLIP-375, Flink 1.19+) ---

// TriggerTaskManagerProfiler starts an async-profiler run on a TaskManager via
// POST /taskmanagers/:id/profiler. duration is in seconds; mode is one of
// ITIMER, CPU, ALLOC, LOCK, WALL. It returns the created (RUNNING) instance.
// A 404 is mapped to ErrProfilingUnsupported so callers can distinguish
// "profiling off" from a transport failure.
func (s *Service) TriggerTaskManagerProfiler(ctx context.Context, tmID, mode string, duration int) (*ProfilingInfo, error) {
	var info ProfilingInfo
	req := ProfilingRequest{Duration: duration, Mode: mode}
	if err := s.client.PostJSON(ctx, "/taskmanagers/"+url.PathEscape(tmID)+"/profiler", req, &info); err != nil {
		if IsNotFound(err) {
			return nil, ErrProfilingUnsupported
		}
		return nil, err
	}
	return &info, nil
}

// TriggerJobManagerProfiler starts an async-profiler run on the JobManager via
// POST /jobmanager/profiler. See TriggerTaskManagerProfiler for semantics.
func (s *Service) TriggerJobManagerProfiler(ctx context.Context, mode string, duration int) (*ProfilingInfo, error) {
	var info ProfilingInfo
	req := ProfilingRequest{Duration: duration, Mode: mode}
	if err := s.client.PostJSON(ctx, "/jobmanager/profiler", req, &info); err != nil {
		if IsNotFound(err) {
			return nil, ErrProfilingUnsupported
		}
		return nil, err
	}
	return &info, nil
}

// ListTaskManagerProfilerInstances returns the profiling history for a
// TaskManager via GET /taskmanagers/:id/profiler. A 404 (profiling
// unsupported/disabled) yields an empty list so callers can feature-detect.
func (s *Service) ListTaskManagerProfilerInstances(ctx context.Context, tmID string) ([]ProfilingInfo, error) {
	var list ProfilingInfoList
	if err := s.client.GetJSON(ctx, "/taskmanagers/"+url.PathEscape(tmID)+"/profiler", &list); err != nil {
		if IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return list.ProfilingList, nil
}

// ListJobManagerProfilerInstances returns the JobManager profiling history via
// GET /jobmanager/profiler. A 404 yields an empty list.
func (s *Service) ListJobManagerProfilerInstances(ctx context.Context) ([]ProfilingInfo, error) {
	var list ProfilingInfoList
	if err := s.client.GetJSON(ctx, "/jobmanager/profiler", &list); err != nil {
		if IsNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	return list.ProfilingList, nil
}
