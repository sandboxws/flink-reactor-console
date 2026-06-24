package flink

// ExceptionHistoryEntry represents a single exception in the exception history.
type ExceptionHistoryEntry struct {
	ExceptionName string            `json:"exceptionName"`
	Stacktrace    string            `json:"stacktrace"`
	Timestamp     int64             `json:"timestamp"`
	TaskName      *string           `json:"taskName"`
	Endpoint      *string           `json:"endpoint"`
	TaskManagerID *string           `json:"taskManagerId"`
	FailureLabels map[string]string `json:"failureLabels"`
}

// JobExceptions represents the GET /jobs/:jobid/exceptions response.
type JobExceptions struct {
	ExceptionHistory struct {
		Entries   []ExceptionHistoryEntry `json:"entries"`
		Truncated bool                    `json:"truncated"`
	} `json:"exceptionHistory"`
}

// CheckpointMinMaxAvg represents min/avg/max statistics for a checkpoint metric.
type CheckpointMinMaxAvg struct {
	Min int64 `json:"min"`
	Max int64 `json:"max"`
	Avg int64 `json:"avg"`
}

// CheckpointHistoryEntry represents a single checkpoint in the history.
type CheckpointHistoryEntry struct {
	ID                     int64  `json:"id"`
	Status                 string `json:"status"`
	IsSavepoint            bool   `json:"is_savepoint"`
	TriggerTimestamp       int64  `json:"trigger_timestamp"`
	LatestAckTimestamp     int64  `json:"latest_ack_timestamp"`
	StateSize              int64  `json:"state_size"`
	EndToEndDuration       int64  `json:"end_to_end_duration"`
	ProcessedData          int64  `json:"processed_data"`
	PersistedData          int64  `json:"persisted_data"`
	NumSubtasks            int    `json:"num_subtasks"`
	NumAcknowledgedSubtask int    `json:"num_acknowledged_subtasks"`
	CheckpointedSize       *int64 `json:"checkpointed_size,omitempty"`
}

// CheckpointRestoredInfo represents restored checkpoint info.
type CheckpointRestoredInfo struct {
	ID               int64   `json:"id"`
	RestoreTimestamp int64   `json:"restore_timestamp"`
	IsSavepoint      bool    `json:"is_savepoint"`
	ExternalPath     *string `json:"external_path,omitempty"`
}

// CheckpointSummary represents the summary section of checkpoint statistics.
type CheckpointSummary struct {
	StateSize        *CheckpointMinMaxAvg `json:"state_size,omitempty"`
	EndToEndDuration *CheckpointMinMaxAvg `json:"end_to_end_duration,omitempty"`
	CheckpointedSize *CheckpointMinMaxAvg `json:"checkpointed_size,omitempty"`
	ProcessedData    *CheckpointMinMaxAvg `json:"processed_data,omitempty"`
	PersistedData    *CheckpointMinMaxAvg `json:"persisted_data,omitempty"`
}

// CheckpointCounts represents the counts within checkpoint statistics.
type CheckpointCounts struct {
	Completed  int `json:"completed"`
	InProgress int `json:"in_progress"`
	Failed     int `json:"failed"`
	Total      int `json:"total"`
	Restored   int `json:"restored"`
}

// CheckpointLatest represents the latest checkpoint entries.
type CheckpointLatest struct {
	Completed *CheckpointHistoryEntry `json:"completed,omitempty"`
	Failed    *CheckpointHistoryEntry `json:"failed,omitempty"`
	Savepoint *CheckpointHistoryEntry `json:"savepoint,omitempty"`
	Restored  *CheckpointRestoredInfo `json:"restored,omitempty"`
}

// CheckpointStats represents the GET /jobs/:jobid/checkpoints response.
type CheckpointStats struct {
	Counts  CheckpointCounts         `json:"counts"`
	History []CheckpointHistoryEntry `json:"history"`
	Summary *CheckpointSummary       `json:"summary,omitempty"`
	Latest  *CheckpointLatest        `json:"latest,omitempty"`
}

// CheckpointConfig represents the GET /jobs/:jobid/checkpoints/config response.
type CheckpointConfig struct {
	Mode            string `json:"mode"`
	Interval        int64  `json:"interval"`
	Timeout         int64  `json:"timeout"`
	MinPause        int64  `json:"min_pause"`
	MaxConcurrent   int    `json:"max_concurrent"`
	Externalization struct {
		Enabled              bool `json:"enabled"`
		DeleteOnCancellation bool `json:"delete_on_cancellation"`
	} `json:"externalization"`
	UnalignedCheckpoints bool `json:"unaligned_checkpoints"`
}

// CheckpointTaskStats represents per-vertex checkpoint stats within the checkpoint detail.
type CheckpointTaskStats struct {
	ID                     string `json:"id"`
	Status                 string `json:"status"`
	LatestAckTimestamp     int64  `json:"latest_ack_timestamp"`
	StateSize              int64  `json:"state_size"`
	EndToEndDuration       int64  `json:"end_to_end_duration"`
	NumSubtasks            int    `json:"num_subtasks"`
	NumAcknowledgedSubtask int    `json:"num_acknowledged_subtasks"`
	CheckpointedSize       *int64 `json:"checkpointed_size,omitempty"`
	ProcessedData          *int64 `json:"processed_data,omitempty"`
	PersistedData          *int64 `json:"persisted_data,omitempty"`
}

// CheckpointDetail represents the GET /jobs/:jid/checkpoints/:cpid/details response.
type CheckpointDetail struct {
	ID                     int64                          `json:"id"`
	Status                 string                         `json:"status"`
	IsSavepoint            bool                           `json:"is_savepoint"`
	TriggerTimestamp       int64                          `json:"trigger_timestamp"`
	LatestAckTimestamp     int64                          `json:"latest_ack_timestamp"`
	StateSize              int64                          `json:"state_size"`
	EndToEndDuration       int64                          `json:"end_to_end_duration"`
	NumSubtasks            int                            `json:"num_subtasks"`
	NumAcknowledgedSubtask int                            `json:"num_acknowledged_subtasks"`
	Tasks                  map[string]CheckpointTaskStats `json:"tasks"`
	CheckpointType         *string                        `json:"checkpoint_type,omitempty"`
	ExternalPath           *string                        `json:"external_path,omitempty"`
	Discarded              *bool                          `json:"discarded,omitempty"`
	CheckpointedSize       *int64                         `json:"checkpointed_size,omitempty"`
	ProcessedData          *int64                         `json:"processed_data,omitempty"`
	PersistedData          *int64                         `json:"persisted_data,omitempty"`
}

// JobConfig represents the GET /jobs/:jobid/config response.
type JobConfig struct {
	JID             string `json:"jid"`
	Name            string `json:"name"`
	ExecutionConfig struct {
		ExecutionMode   string            `json:"execution-mode"`
		RestartStrategy string            `json:"restart-strategy"`
		JobParallelism  int               `json:"job-parallelism"`
		ObjectReuseMode bool              `json:"object-reuse-mode"`
		UserConfig      map[string]string `json:"user-config"`
	} `json:"execution-config"`
}

// WatermarkEntry represents a single watermark metric entry.
type WatermarkEntry struct {
	ID    string `json:"id"`
	Value string `json:"value"`
}

// Watermarks is a slice of WatermarkEntry (bare JSON array response).
type Watermarks = []WatermarkEntry

// SubtaskBackPressure represents per-subtask backpressure data.
type SubtaskBackPressure struct {
	Subtask           int     `json:"subtask"`
	AttemptNumber     int     `json:"attempt-number"`
	BackpressureLevel string  `json:"backpressureLevel"`
	Ratio             float64 `json:"ratio"`
	BusyRatio         float64 `json:"busyRatio"`
	IdleRatio         float64 `json:"idleRatio"`
}

// BackPressure represents the GET /jobs/:jid/vertices/:vid/backpressure response.
type BackPressure struct {
	Status            string                `json:"status"`
	BackpressureLevel string                `json:"backpressureLevel"`
	EndTimestamp      int64                 `json:"end-timestamp"`
	Subtasks          []SubtaskBackPressure `json:"subtasks"`
}

// UserAccumulator represents a single user accumulator entry.
type UserAccumulator struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Value string `json:"value"`
}

// Accumulators represents the GET /jobs/:jid/vertices/:vid/accumulators response.
type Accumulators struct {
	ID               string            `json:"id"`
	UserAccumulators []UserAccumulator `json:"user-accumulators"`
}

// SubtaskInfo represents a subtask entry within vertex detail.
type SubtaskInfo struct {
	Subtask       int           `json:"subtask"`
	Status        string        `json:"status"`
	Attempt       int           `json:"attempt"`
	Endpoint      string        `json:"endpoint"`
	StartTime     int64         `json:"start-time"`
	EndTime       int64         `json:"end-time"`
	Duration      int64         `json:"duration"`
	Metrics       VertexMetrics `json:"metrics"`
	TaskManagerID string        `json:"taskmanager-id"`
}

// VertexDetail represents the GET /jobs/:jid/vertices/:vid response.
type VertexDetail struct {
	ID          string        `json:"id"`
	Name        string        `json:"name"`
	Parallelism int           `json:"parallelism"`
	Now         int64         `json:"now"`
	Subtasks    []SubtaskInfo `json:"subtasks"`
}

// SubtaskTimesEntry represents a single subtask timing entry.
type SubtaskTimesEntry struct {
	Subtask    int              `json:"subtask"`
	Host       string           `json:"host"`
	Duration   int64            `json:"duration"`
	Timestamps map[string]int64 `json:"timestamps"`
}

// SubtaskTimes represents the GET /jobs/:jid/vertices/:vid/subtasktimes response.
type SubtaskTimes struct {
	ID       string              `json:"id"`
	Name     string              `json:"name"`
	Now      int64               `json:"now"`
	Subtasks []SubtaskTimesEntry `json:"subtasks"`
}

// FlamegraphNode represents a node in the flamegraph tree.
type FlamegraphNode struct {
	Name     string           `json:"name"`
	Value    int64            `json:"value"`
	Children []FlamegraphNode `json:"children,omitempty"`
}

// Flamegraph represents the GET /jobs/:jid/vertices/:vid/flamegraph response.
type Flamegraph struct {
	EndTimestamp int64          `json:"end-timestamp"`
	Data         FlamegraphNode `json:"data"`
}

// MetricItem represents a single metric entry (reused across TM, JM, vertex metrics).
type MetricItem struct {
	ID    string `json:"id"`
	Value string `json:"value"`
}

// AggregatedSubtaskMetric represents one row from
// GET /jobs/:jid/vertices/:vid/subtasks/metrics — the same metric IDs as the
// per-subtask metrics endpoint, but aggregated across all subtasks. `Skew` is
// (max - avg) / avg and useful as a free imbalance signal.
type AggregatedSubtaskMetric struct {
	ID   string  `json:"id"`
	Min  float64 `json:"min"`
	Max  float64 `json:"max"`
	Avg  float64 `json:"avg"`
	Sum  float64 `json:"sum"`
	Skew float64 `json:"skew"`
}

// SavepointOperationStatus wraps Flink's per-operation status enum.
// `id` is one of "IN_PROGRESS" or "COMPLETED".
type SavepointOperationStatus struct {
	ID string `json:"id"`
}

// SavepointOperationDetail carries the completion result of a savepoint
// operation. Exactly one of `location` (success) or `failure-cause` (failure)
// is populated once the operation finishes; both are empty while in-progress.
type SavepointOperationDetail struct {
	Location     string `json:"location,omitempty"`
	FailureCause string `json:"failure-cause,omitempty"`
}

// SavepointInfo represents one entry in GET /jobs/:jid/savepoints.
// The detail endpoint GET /jobs/:jid/savepoints/:id returns the same shape
// without the surrounding `operations` array.
//
// Flink's response shape varies slightly across versions; unknown fields are
// ignored by json.Unmarshal so this remains forward-compatible.
type SavepointInfo struct {
	// OperationID is Flink's savepoint operation handle (UUID-ish).
	OperationID string                   `json:"operation-id"`
	Status      SavepointOperationStatus `json:"status"`
	Operation   SavepointOperationDetail `json:"operation"`
	// TriggerTimestamp is the timestamp at which the operation was triggered,
	// in epoch millis. Flink returns this as `triggerTimestamp` (camelCase).
	TriggerTimestamp int64 `json:"triggerTimestamp"`
	// SizeBytes is populated only after the operation completes. The Flink
	// REST endpoint does not include size for in-progress operations.
	SizeBytes int64 `json:"size,omitempty"`
	// DurationMs is the trigger-to-completion duration in milliseconds.
	// Zero until the operation completes.
	DurationMs int64 `json:"duration,omitempty"`
}

// SavepointList represents the GET /jobs/:jid/savepoints response envelope.
//
// Flink wraps the savepoint list in `{"operations": [...]}` on most versions;
// keep the wrapper explicit so the decoder can ignore other top-level fields.
type SavepointList struct {
	Operations []SavepointInfo `json:"operations"`
}

// --- Rescale history (Flink 2.3+, FLIP-495 AdaptiveScheduler rescale REST) ---

// RescaleEventInfo represents one AdaptiveScheduler rescale event from
// GET /jobs/:jid/rescales/{history,details/:uuid}. Field names follow the
// FLIP-495 REST shape; decoding is tolerant (unknown fields ignored) so this
// survives minor differences in the released Flink 2.3 response.
type RescaleEventInfo struct {
	UUID              string `json:"uuid"`
	Status            string `json:"status"`
	TriggerTimestamp  int64  `json:"trigger-timestamp"`
	Duration          int64  `json:"duration,omitempty"`
	ParallelismBefore int    `json:"parallelism-before,omitempty"`
	ParallelismAfter  int    `json:"parallelism-after,omitempty"`
	FailureCause      string `json:"failure-cause,omitempty"`
}

// RescaleHistoryList wraps GET /jobs/:jid/rescales/history.
type RescaleHistoryList struct {
	Rescales []RescaleEventInfo `json:"rescales"`
}

// RescaleSummaryInfo wraps GET /jobs/:jid/rescales/summary.
type RescaleSummaryInfo struct {
	TotalRescales int   `json:"total-rescales,omitempty"`
	LastRescaleAt int64 `json:"last-rescale-timestamp,omitempty"`
}
