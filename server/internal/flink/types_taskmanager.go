package flink

// TaskManagerHardware represents hardware info within a task manager entry.
type TaskManagerHardware struct {
	CPUCores       int   `json:"cpuCores"`
	PhysicalMemory int64 `json:"physicalMemory"`
	FreeMemory     int64 `json:"freeMemory"`
	ManagedMemory  int64 `json:"managedMemory"`
}

// TaskManagerResourceProfile represents a resource profile (total/free).
type TaskManagerResourceProfile struct {
	CPUCores       float64 `json:"cpuCores"`
	TaskHeapMemory int64   `json:"taskHeapMemory"`
	TaskOffHeap    int64   `json:"taskOffHeapMemory"`
	ManagedMemory  int64   `json:"managedMemory"`
	NetworkMemory  int64   `json:"networkMemory"`
}

// TaskManagerMemory represents the memory configuration of a task manager.
type TaskManagerMemory struct {
	FrameworkHeap      int64 `json:"frameworkHeap"`
	TaskHeap           int64 `json:"taskHeap"`
	FrameworkOffHeap   int64 `json:"frameworkOffHeap"`
	TaskOffHeap        int64 `json:"taskOffHeap"`
	NetworkMemory      int64 `json:"networkMemory"`
	ManagedMemory      int64 `json:"managedMemory"`
	JVMMetaspace       int64 `json:"jvmMetaspace"`
	JVMOverhead        int64 `json:"jvmOverhead"`
	TotalFlinkMemory   int64 `json:"totalFlinkMemory"`
	TotalProcessMemory int64 `json:"totalProcessMemory"`
}

// AllocatedSlot represents an allocated slot in a task manager.
type AllocatedSlot struct {
	Index    int                        `json:"index"`
	JobID    string                     `json:"jobId"`
	Resource TaskManagerResourceProfile `json:"resource"`
}

// TaskManagerItem represents a single task manager entry in the GET /taskmanagers response.
type TaskManagerItem struct {
	ID                     string                     `json:"id"`
	Path                   string                     `json:"path"`
	DataPort               int                        `json:"dataPort"`
	JMXPort                int                        `json:"jmxPort"`
	TimeSinceLastHeartbeat int64                      `json:"timeSinceLastHeartbeat"`
	SlotsNumber            int                        `json:"slotsNumber"`
	FreeSlots              int                        `json:"freeSlots"`
	TotalResource          TaskManagerResourceProfile `json:"totalResource"`
	FreeResource           TaskManagerResourceProfile `json:"freeResource"`
	Hardware               TaskManagerHardware        `json:"hardware"`
	MemoryConfiguration    TaskManagerMemory          `json:"memoryConfiguration"`
	AllocatedSlots         []AllocatedSlot            `json:"allocatedSlots"`
}

// TaskManagerList represents the GET /taskmanagers response.
type TaskManagerList struct {
	TaskManagers []TaskManagerItem `json:"taskmanagers"`
}

// TaskManagerDetail is the same as TaskManagerItem (standalone response).
type TaskManagerDetail = TaskManagerItem

// TaskManagerMetrics is a slice of MetricItem for TM metrics.
type TaskManagerMetrics = []MetricItem

// TMLogEntry represents a single log file entry.
type TMLogEntry struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
}

// TMLogList represents the GET /taskmanagers/:tmid/logs response.
type TMLogList struct {
	Logs []TMLogEntry `json:"logs"`
}

// TMThreadDumpEntry represents a single thread in a thread dump.
type TMThreadDumpEntry struct {
	ThreadName            string `json:"threadName"`
	StringifiedThreadInfo string `json:"stringifiedThreadInfo"`
}

// TMThreadDump represents the GET /taskmanagers/:tmid/thread-dump response.
type TMThreadDump struct {
	ThreadInfos []TMThreadDumpEntry `json:"threadInfos"`
}
