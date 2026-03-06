package flink

// JobStatusEvent represents a detected job status transition.
type JobStatusEvent struct {
	JobID          string  `json:"jobId"`
	JobName        string  `json:"jobName"`
	PreviousStatus *string `json:"previousStatus,omitempty"`
	CurrentStatus  string  `json:"currentStatus"`
}

// ClusterOverview represents the GET /overview response.
type ClusterOverview struct {
	FlinkVersion   string `json:"flink-version"`
	FlinkCommit    string `json:"flink-commit"`
	SlotsTotal     int    `json:"slots-total"`
	SlotsAvailable int    `json:"slots-available"`
	JobsRunning    int    `json:"jobs-running"`
	JobsFinished   int    `json:"jobs-finished"`
	JobsCancelled  int    `json:"jobs-cancelled"`
	JobsFailed     int    `json:"jobs-failed"`
	TaskManagers   int    `json:"taskmanagers"`
}

// TaskCounts represents the 10 Flink-native task states (lowercase keys in job overview).
type TaskCounts struct {
	Created      int `json:"created"`
	Scheduled    int `json:"scheduled"`
	Deploying    int `json:"deploying"`
	Running      int `json:"running"`
	Finished     int `json:"finished"`
	Canceling    int `json:"canceling"`
	Canceled     int `json:"canceled"`
	Failed       int `json:"failed"`
	Reconciling  int `json:"reconciling"`
	Initializing int `json:"initializing"`
}

// JobOverview represents a single job entry in the GET /jobs/overview response.
type JobOverview struct {
	JID              string     `json:"jid"`
	Name             string     `json:"name"`
	State            string     `json:"state"`
	StartTime        int64      `json:"start-time"`
	EndTime          int64      `json:"end-time"`
	Duration         int64      `json:"duration"`
	LastModification int64      `json:"last-modification"`
	Tasks            TaskCounts `json:"tasks"`
}

// JobsOverview represents the GET /jobs/overview response.
type JobsOverview struct {
	Jobs []JobOverview `json:"jobs"`
}

// PlanNodeInput represents an input edge within a plan node.
type PlanNodeInput struct {
	Num          int    `json:"num"`
	ID           string `json:"id"`
	ShipStrategy string `json:"ship_strategy"`
	Exchange     string `json:"exchange"`
}

// PlanNode represents a single node within the execution plan.
type PlanNode struct {
	ID               string          `json:"id"`
	Parallelism      int             `json:"parallelism"`
	Operator         string          `json:"operator"`
	OperatorStrategy string          `json:"operator_strategy"`
	Description      string          `json:"description"`
	Inputs           []PlanNodeInput `json:"inputs,omitempty"`
}

// JobPlan represents the execution plan within a job detail response.
type JobPlan struct {
	JID   string     `json:"jid"`
	Name  string     `json:"name"`
	Type  string     `json:"type"`
	Nodes []PlanNode `json:"nodes"`
}

// VertexMetrics represents I/O metrics within a vertex entry.
// Flink REST returns all numeric metric values as JSON floats (e.g. 68.0),
// so we use float64 to avoid unmarshal errors.
type VertexMetrics struct {
	ReadBytes                float64 `json:"read-bytes"`
	ReadBytesComplete        bool    `json:"read-bytes-complete"`
	WriteBytes               float64 `json:"write-bytes"`
	WriteBytesComplete       bool    `json:"write-bytes-complete"`
	ReadRecords              float64 `json:"read-records"`
	ReadRecordsComplete      bool    `json:"read-records-complete"`
	WriteRecords             float64 `json:"write-records"`
	WriteRecordsComplete     bool    `json:"write-records-complete"`
	AccumulatedBackpressured float64 `json:"accumulated-backpressured-time"`
	AccumulatedIdle          float64 `json:"accumulated-idle-time"`
	AccumulatedBusy          float64 `json:"accumulated-busy-time"`
}

// Vertex represents a single vertex entry within GET /jobs/:jobid → vertices[].
// Task counts use UPPERCASE keys (unlike TaskCounts which uses lowercase).
type Vertex struct {
	ID             string         `json:"id"`
	Name           string         `json:"name"`
	MaxParallelism int            `json:"maxParallelism"`
	Parallelism    int            `json:"parallelism"`
	Status         string         `json:"status"`
	StartTime      int64          `json:"start-time"`
	EndTime        int64          `json:"end-time"`
	Duration       int64          `json:"duration"`
	Tasks          map[string]int `json:"tasks"`
	Metrics        VertexMetrics  `json:"metrics"`
}

// VertexTaskCounts provides typed access to UPPERCASE vertex task counts.
type VertexTaskCounts struct {
	CREATED      int `json:"CREATED"`
	SCHEDULED    int `json:"SCHEDULED"`
	DEPLOYING    int `json:"DEPLOYING"`
	RUNNING      int `json:"RUNNING"`
	FINISHED     int `json:"FINISHED"`
	CANCELING    int `json:"CANCELING"`
	CANCELED     int `json:"CANCELED"`
	FAILED       int `json:"FAILED"`
	RECONCILING  int `json:"RECONCILING"`
	INITIALIZING int `json:"INITIALIZING"`
}

// JobDetail represents the GET /jobs/:jobid response.
type JobDetail struct {
	JID          string           `json:"jid"`
	Name         string           `json:"name"`
	State        string           `json:"state"`
	StartTime    int64            `json:"start-time"`
	EndTime      int64            `json:"end-time"`
	Duration     int64            `json:"duration"`
	Now          int64            `json:"now"`
	Timestamps   map[string]int64 `json:"timestamps"`
	Vertices     []Vertex         `json:"vertices"`
	StatusCounts map[string]int   `json:"status-counts"`
	Plan         JobPlan          `json:"plan"`
}
