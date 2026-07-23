package flink

import "errors"

// ErrProfilingUnsupported indicates the target cluster does not support or has
// not enabled Flink's built-in async profiler. It is returned when a profiler
// trigger receives a 404, which happens on clusters older than Flink 1.19
// (FLIP-375) or where `rest.profiling.enabled` is not set.
var ErrProfilingUnsupported = errors.New(
	"async profiler unsupported or disabled on this cluster " +
		"(requires Flink >= 1.19 and rest.profiling.enabled)",
)

// ProfilingRequest is the body of POST /taskmanagers/:id/profiler and
// POST /jobmanager/profiler (FLIP-375, Flink 1.19+).
type ProfilingRequest struct {
	// Duration is the profiling window in seconds.
	Duration int `json:"duration"`
	// Mode is the async-profiler event mode: ITIMER, CPU, ALLOC, LOCK, or WALL.
	Mode string `json:"mode"`
}

// ProfilingInfo is a single async-profiler instance reported by Flink. Field
// names mirror org.apache.flink.runtime.rest.messages.ProfilingInfo. Decoding
// is tolerant: unknown fields are ignored so the call survives minor schema
// drift across Flink versions.
type ProfilingInfo struct {
	// Status is RUNNING, FINISHED, or FAILED.
	Status string `json:"status"`
	// Mode echoes the requested event mode.
	Mode string `json:"mode"`
	// TriggerTime is when the run was requested, in epoch millis.
	TriggerTime int64 `json:"triggerTime"`
	// FinishedTime is when the run completed, in epoch millis (0 while RUNNING).
	FinishedTime int64 `json:"finishedTime"`
	// Duration is the requested profiling window in seconds.
	Duration int64 `json:"duration"`
	// Message carries the failure reason when Status is FAILED.
	Message string `json:"message"`
	// OutputFile is the flame-graph file name, set once the run is FINISHED.
	// Flink assigns it at trigger time, so it is stable across a run's polls.
	OutputFile string `json:"outputFile"`
}

// ProfilingInfoList is the GET /taskmanagers/:id/profiler and
// GET /jobmanager/profiler response envelope. Flink wraps the instance history
// in {"profilingList": [...]}.
type ProfilingInfoList struct {
	ProfilingList []ProfilingInfo `json:"profilingList"`
}
