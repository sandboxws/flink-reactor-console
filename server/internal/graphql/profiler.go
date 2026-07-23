package graphql

import (
	"net/url"
	"strconv"

	"github.com/sandboxws/flink-reactor-console/server/internal/flink"
	"github.com/sandboxws/flink-reactor-console/server/internal/graphql/model"
)

// mapProfilerInstance converts a Flink ProfilingInfo into the GraphQL model.
// downloadURL builds the Console-proxied link for a given output file; it is
// only invoked for FINISHED runs that produced a file. message is surfaced for
// FAILED runs.
func mapProfilerInstance(info flink.ProfilingInfo, downloadURL func(outputFile string) string) *model.ProfilerInstance {
	// Flink's ProfilingInfo has no explicit id; the output file name is unique
	// per run and assigned at trigger time. Fall back to the trigger timestamp
	// for the brief window before a file name exists.
	id := info.OutputFile
	if id == "" {
		id = strconv.FormatInt(info.TriggerTime, 10)
	}

	pi := &model.ProfilerInstance{
		ID:       id,
		Status:   model.ProfilerStatus(info.Status),
		Mode:     model.ProfilerMode(info.Mode),
		Duration: int(info.Duration),
	}
	if info.Message != "" {
		msg := info.Message
		pi.Message = &msg
	}
	if info.OutputFile != "" {
		out := info.OutputFile
		pi.OutputFile = &out
		if info.Status == string(model.ProfilerStatusFinished) {
			u := downloadURL(info.OutputFile)
			pi.DownloadURL = &u
		}
	}
	return pi
}

// taskManagerProfilerDownloadURL returns a builder for the Console-proxied
// flame-graph URL of a TaskManager profiler run. The URL targets the
// internal/logs proxy, never Flink directly.
func taskManagerProfilerDownloadURL(clusterName, tmID string) func(string) string {
	return func(outputFile string) string {
		u := "/api/logs/taskmanagers/" + url.PathEscape(tmID) + "/profiler/" + url.PathEscape(outputFile)
		return appendClusterParam(u, clusterName)
	}
}

// jobManagerProfilerDownloadURL returns a builder for the Console-proxied
// flame-graph URL of a JobManager profiler run.
func jobManagerProfilerDownloadURL(clusterName string) func(string) string {
	return func(outputFile string) string {
		u := "/api/logs/jobmanager/profiler/" + url.PathEscape(outputFile)
		return appendClusterParam(u, clusterName)
	}
}

// appendClusterParam appends ?cluster=<name> so the proxy routes to the same
// connection the run was triggered on, independent of which cluster is default.
func appendClusterParam(u, clusterName string) string {
	if clusterName == "" {
		return u
	}
	return u + "?cluster=" + url.QueryEscape(clusterName)
}
