package storage

import (
	"encoding/json"
	"fmt"
	"time"

	"github.com/sandboxws/flink-reactor/apps/server/internal/flink"
)

// msToTime converts a Flink epoch-millisecond timestamp to time.Time.
// Returns zero time for non-positive values.
func msToTime(ms int64) time.Time {
	if ms <= 0 {
		return time.Time{}
	}
	return time.UnixMilli(ms)
}

// ptrMsToTime is like msToTime but returns a pointer (nil for zero).
func ptrMsToTime(ms int64) *time.Time {
	if ms <= 0 {
		return nil
	}
	t := time.UnixMilli(ms)
	return &t
}

// DBCluster mirrors the clusters table.
type DBCluster struct {
	Name      string    `db:"name"`
	URL       string    `db:"url"`
	IsDefault bool      `db:"is_default"`
	CreatedAt time.Time `db:"created_at"`
	UpdatedAt time.Time `db:"updated_at"`
}

// DBJob mirrors the jobs table.
type DBJob struct {
	JID            string          `db:"jid"`
	Cluster        string          `db:"cluster"`
	Name           string          `db:"name"`
	State          string          `db:"state"`
	StartTime      *time.Time      `db:"start_time"`
	EndTime        *time.Time      `db:"end_time"`
	DurationMs     int64           `db:"duration_ms"`
	LastModified   *time.Time      `db:"last_modified"`
	TasksTotal     int             `db:"tasks_total"`
	TasksRunning   int             `db:"tasks_running"`
	TasksFinished  int             `db:"tasks_finished"`
	TasksCanceled  int             `db:"tasks_canceled"`
	TasksFailed    int             `db:"tasks_failed"`
	CapturedAt     time.Time       `db:"captured_at"`
	DetailSnapshot json.RawMessage `db:"detail_snapshot"`
}

// FromFlinkJobOverview converts a Flink JobOverview to a DBJob.
func FromFlinkJobOverview(j flink.JobOverview, cluster string) DBJob {
	return DBJob{
		JID:           j.JID,
		Cluster:       cluster,
		Name:          j.Name,
		State:         j.State,
		StartTime:     ptrMsToTime(j.StartTime),
		EndTime:       ptrMsToTime(j.EndTime),
		DurationMs:    j.Duration,
		LastModified:  ptrMsToTime(j.LastModification),
		TasksTotal:    j.Tasks.Running + j.Tasks.Finished + j.Tasks.Canceled + j.Tasks.Failed + j.Tasks.Created + j.Tasks.Scheduled + j.Tasks.Deploying + j.Tasks.Canceling + j.Tasks.Reconciling + j.Tasks.Initializing,
		TasksRunning:  j.Tasks.Running,
		TasksFinished: j.Tasks.Finished,
		TasksCanceled: j.Tasks.Canceled,
		TasksFailed:   j.Tasks.Failed,
		CapturedAt:    time.Now(),
	}
}

// DBVertex mirrors the vertices table.
type DBVertex struct {
	ID             string     `db:"id"`
	JID            string     `db:"jid"`
	Cluster        string     `db:"cluster"`
	Name           string     `db:"name"`
	Parallelism    int        `db:"parallelism"`
	MaxParallelism int        `db:"max_parallelism"`
	Status         string     `db:"status"`
	StartTime      *time.Time `db:"start_time"`
	EndTime        *time.Time `db:"end_time"`
	DurationMs     int64      `db:"duration_ms"`
	ReadBytes      float64    `db:"read_bytes"`
	WriteBytes     float64    `db:"write_bytes"`
	ReadRecords    float64    `db:"read_records"`
	WriteRecords   float64    `db:"write_records"`
	CapturedAt     time.Time  `db:"captured_at"`
}

// FromFlinkVertex converts a Flink Vertex to a DBVertex.
func FromFlinkVertex(v flink.Vertex, jid, cluster string) DBVertex {
	return DBVertex{
		ID:             v.ID,
		JID:            jid,
		Cluster:        cluster,
		Name:           v.Name,
		Parallelism:    v.Parallelism,
		MaxParallelism: v.MaxParallelism,
		Status:         v.Status,
		StartTime:      ptrMsToTime(v.StartTime),
		EndTime:        ptrMsToTime(v.EndTime),
		DurationMs:     v.Duration,
		ReadBytes:      v.Metrics.ReadBytes,
		WriteBytes:     v.Metrics.WriteBytes,
		ReadRecords:    v.Metrics.ReadRecords,
		WriteRecords:   v.Metrics.WriteRecords,
		CapturedAt:     time.Now(),
	}
}

// DBCheckpoint mirrors the checkpoints table.
type DBCheckpoint struct {
	CheckpointID     int64      `db:"checkpoint_id"`
	JID              string     `db:"jid"`
	Cluster          string     `db:"cluster"`
	Status           string     `db:"status"`
	IsSavepoint      bool       `db:"is_savepoint"`
	TriggerTimestamp *time.Time `db:"trigger_timestamp"`
	LatestAck        *time.Time `db:"latest_ack"`
	StateSize        int64      `db:"state_size"`
	EndToEndDuration int64      `db:"end_to_end_duration"`
	ProcessedData    int64      `db:"processed_data"`
	PersistedData    int64      `db:"persisted_data"`
	NumSubtasks      int        `db:"num_subtasks"`
	NumAckSubtasks   int        `db:"num_ack_subtasks"`
	CheckpointedSize *int64     `db:"checkpointed_size"`
	CapturedAt       time.Time  `db:"captured_at"`
}

// FromFlinkCheckpoint converts a Flink CheckpointHistoryEntry to a DBCheckpoint.
func FromFlinkCheckpoint(c flink.CheckpointHistoryEntry, jid, cluster string) DBCheckpoint {
	return DBCheckpoint{
		CheckpointID:     c.ID,
		JID:              jid,
		Cluster:          cluster,
		Status:           c.Status,
		IsSavepoint:      c.IsSavepoint,
		TriggerTimestamp: ptrMsToTime(c.TriggerTimestamp),
		LatestAck:        ptrMsToTime(c.LatestAckTimestamp),
		StateSize:        c.StateSize,
		EndToEndDuration: c.EndToEndDuration,
		ProcessedData:    c.ProcessedData,
		PersistedData:    c.PersistedData,
		NumSubtasks:      c.NumSubtasks,
		NumAckSubtasks:   c.NumAcknowledgedSubtask,
		CheckpointedSize: c.CheckpointedSize,
		CapturedAt:       time.Now(),
	}
}

// DBException mirrors the exceptions table.
type DBException struct {
	ID            int64     `db:"id"`
	JID           string    `db:"jid"`
	Cluster       string    `db:"cluster"`
	ExceptionName string    `db:"exception_name"`
	Stacktrace    string    `db:"stacktrace"`
	Timestamp     time.Time `db:"timestamp"`
	TaskName      *string   `db:"task_name"`
	Endpoint      *string   `db:"endpoint"`
	TaskManagerID *string   `db:"task_manager_id"`
	CapturedAt    time.Time `db:"captured_at"`
}

// FromFlinkException converts a Flink ExceptionHistoryEntry to a DBException.
func FromFlinkException(e flink.ExceptionHistoryEntry, jid, cluster string) DBException {
	return DBException{
		JID:           jid,
		Cluster:       cluster,
		ExceptionName: e.ExceptionName,
		Stacktrace:    e.Stacktrace,
		Timestamp:     msToTime(e.Timestamp),
		TaskName:      e.TaskName,
		Endpoint:      e.Endpoint,
		TaskManagerID: e.TaskManagerID,
		CapturedAt:    time.Now(),
	}
}

// DBTaskManagerSnapshot mirrors the task_manager_snapshots table.
type DBTaskManagerSnapshot struct {
	ID             string          `db:"id"`
	Cluster        string          `db:"cluster"`
	Path           string          `db:"path"`
	DataPort       int             `db:"data_port"`
	SlotsTotal     int             `db:"slots_total"`
	SlotsFree      int             `db:"slots_free"`
	CPUCores       int             `db:"cpu_cores"`
	PhysicalMemory int64           `db:"physical_memory"`
	FreeMemory     int64           `db:"free_memory"`
	ManagedMemory  int64           `db:"managed_memory"`
	MemoryConfig   json.RawMessage `db:"memory_config"`
	TotalResource  json.RawMessage `db:"total_resource"`
	FreeResource   json.RawMessage `db:"free_resource"`
	AllocatedSlots json.RawMessage `db:"allocated_slots"`
	CapturedAt     time.Time       `db:"captured_at"`
}

// FromFlinkTaskManager converts a Flink TaskManagerItem to a DBTaskManagerSnapshot.
func FromFlinkTaskManager(tm flink.TaskManagerItem, cluster string) (DBTaskManagerSnapshot, error) {
	memCfg, err := json.Marshal(tm.MemoryConfiguration)
	if err != nil {
		return DBTaskManagerSnapshot{}, fmt.Errorf("marshal memory_config: %w", err)
	}
	totalRes, err := json.Marshal(tm.TotalResource)
	if err != nil {
		return DBTaskManagerSnapshot{}, fmt.Errorf("marshal total_resource: %w", err)
	}
	freeRes, err := json.Marshal(tm.FreeResource)
	if err != nil {
		return DBTaskManagerSnapshot{}, fmt.Errorf("marshal free_resource: %w", err)
	}
	allocSlots, err := json.Marshal(tm.AllocatedSlots)
	if err != nil {
		return DBTaskManagerSnapshot{}, fmt.Errorf("marshal allocated_slots: %w", err)
	}
	return DBTaskManagerSnapshot{
		ID:             tm.ID,
		Cluster:        cluster,
		Path:           tm.Path,
		DataPort:       tm.DataPort,
		SlotsTotal:     tm.SlotsNumber,
		SlotsFree:      tm.FreeSlots,
		CPUCores:       tm.Hardware.CPUCores,
		PhysicalMemory: tm.Hardware.PhysicalMemory,
		FreeMemory:     tm.Hardware.FreeMemory,
		ManagedMemory:  tm.Hardware.ManagedMemory,
		MemoryConfig:   memCfg,
		TotalResource:  totalRes,
		FreeResource:   freeRes,
		AllocatedSlots: allocSlots,
		CapturedAt:     time.Now(),
	}, nil
}

// DBJobManagerSnapshot mirrors the job_manager_snapshots table.
type DBJobManagerSnapshot struct {
	Cluster         string          `db:"cluster"`
	ConfigJSON      json.RawMessage `db:"config_json"`
	EnvironmentJSON json.RawMessage `db:"environment_json"`
	CapturedAt      time.Time       `db:"captured_at"`
}

// FromFlinkJobManager converts Flink JM config and environment to a DBJobManagerSnapshot.
func FromFlinkJobManager(cfg flink.JMConfig, env flink.JMEnvironment, cluster string) (DBJobManagerSnapshot, error) {
	cfgJSON, err := json.Marshal(cfg)
	if err != nil {
		return DBJobManagerSnapshot{}, err
	}
	envJSON, err := json.Marshal(env)
	if err != nil {
		return DBJobManagerSnapshot{}, err
	}
	return DBJobManagerSnapshot{
		Cluster:         cluster,
		ConfigJSON:      cfgJSON,
		EnvironmentJSON: envJSON,
		CapturedAt:      time.Now(),
	}, nil
}

// DBMetric mirrors the metrics hypertable.
type DBMetric struct {
	Cluster    string    `db:"cluster"`
	SourceType string    `db:"source_type"`
	SourceID   string    `db:"source_id"`
	MetricID   string    `db:"metric_id"`
	Value      float64   `db:"value"`
	CapturedAt time.Time `db:"captured_at"`
}

// FromFlinkMetricItem converts a Flink MetricItem to a DBMetric.
func FromFlinkMetricItem(m flink.MetricItem, sourceType, sourceID, cluster string) DBMetric {
	var val float64
	// MetricItem.Value is a string; parse to float.
	f := flink.FlexFloat64(0)
	if err := json.Unmarshal([]byte(`"`+m.Value+`"`), &f); err == nil {
		val = f.Float64()
	}
	return DBMetric{
		Cluster:    cluster,
		SourceType: sourceType,
		SourceID:   sourceID,
		MetricID:   m.ID,
		Value:      val,
		CapturedAt: time.Now().UTC(),
	}
}

// DBTapManifest mirrors the tap_manifests table.
type DBTapManifest struct {
	PipelineName string          `db:"pipeline_name"`
	Manifest     json.RawMessage `db:"manifest"`
	FlinkVersion *string         `db:"flink_version"`
	CreatedAt    time.Time       `db:"created_at"`
	UpdatedAt    time.Time       `db:"updated_at"`
}

// DBLog mirrors the logs table.
type DBLog struct {
	ID         int64     `db:"id"`
	Cluster    string    `db:"cluster"`
	SourceType string    `db:"source_type"`
	SourceID   string    `db:"source_id"`
	LogFile    string    `db:"log_file"`
	Content    string    `db:"content"`
	ByteOffset int64     `db:"byte_offset"`
	CapturedAt time.Time `db:"captured_at"`
}

// DBClusterOverviewSnapshot mirrors the cluster_overview_snapshots table.
type DBClusterOverviewSnapshot struct {
	Cluster        string    `db:"cluster"`
	FlinkVersion   string    `db:"flink_version"`
	SlotsTotal     int       `db:"slots_total"`
	SlotsAvailable int       `db:"slots_available"`
	JobsRunning    int       `db:"jobs_running"`
	JobsFinished   int       `db:"jobs_finished"`
	JobsCancelled  int       `db:"jobs_cancelled"`
	JobsFailed     int       `db:"jobs_failed"`
	TaskManagers   int       `db:"task_managers"`
	CapturedAt     time.Time `db:"captured_at"`
}

// FromFlinkClusterOverview converts a Flink ClusterOverview to a DBClusterOverviewSnapshot.
func FromFlinkClusterOverview(o flink.ClusterOverview, cluster string) DBClusterOverviewSnapshot {
	return DBClusterOverviewSnapshot{
		Cluster:        cluster,
		FlinkVersion:   o.FlinkVersion,
		SlotsTotal:     o.SlotsTotal,
		SlotsAvailable: o.SlotsAvailable,
		JobsRunning:    o.JobsRunning,
		JobsFinished:   o.JobsFinished,
		JobsCancelled:  o.JobsCancelled,
		JobsFailed:     o.JobsFailed,
		TaskManagers:   o.TaskManagers,
		CapturedAt:     time.Now(),
	}
}
