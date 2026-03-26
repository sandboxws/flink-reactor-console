/** Cluster domain types — shared across Overview, Jobs, TM, JM, and Submit pages. */

// --- Job types ---

/** Lifecycle status of a Flink job. */
export type JobStatus =
  | "CREATED"
  | "RUNNING"
  | "FAILING"
  | "FAILED"
  | "CANCELLING"
  | "CANCELED"
  | "FINISHED"
  | "RESTARTING"
  | "SUSPENDED"
  | "RECONCILING"

/** Execution status of an individual task (subtask instance). */
export type TaskStatus =
  | "pending"
  | "running"
  | "finished"
  | "canceling"
  | "failed"

/** Count of tasks in each status, keyed by TaskStatus. */
export type TaskCounts = Record<TaskStatus, number>

// --- Job detail types ---

/** Execution status of a single vertex (operator) in the job graph. */
export type JobVertexStatus =
  | "RUNNING"
  | "FINISHED"
  | "FAILED"
  | "CANCELED"
  | "CREATED"

/** Runtime metrics for a job vertex (operator), aggregated across subtasks. */
export type JobVertexMetrics = {
  recordsIn: number
  recordsOut: number
  bytesIn: number
  bytesOut: number
  /** Fraction of time the operator is busy processing (ms per second). */
  busyTimeMsPerSecond: number
  /** Fraction of time the operator is back-pressured (ms per second). */
  backPressuredTimeMsPerSecond: number
}

/** A vertex (operator) in the Flink job execution graph. */
export type JobVertex = {
  id: string
  name: string
  parallelism: number
  status: JobVertexStatus
  metrics: JobVertexMetrics
  tasks: TaskCounts
  /** Duration in milliseconds since the vertex started. */
  duration: number
  /** Start time as epoch milliseconds. */
  startTime: number
}

/** Data shuffle strategy between two connected operators. */
export type ShipStrategy =
  | "FORWARD"
  | "HASH"
  | "REBALANCE"
  | "BROADCAST"
  | "RESCALE"
  | "GLOBAL"

/** A directed edge in the job execution graph connecting two vertices. */
export type JobEdge = {
  /** Source vertex ID. */
  source: string
  /** Target vertex ID. */
  target: string
  shipStrategy: ShipStrategy
}

/** The execution plan of a Flink job — vertices and edges forming a DAG. */
export type JobPlan = {
  vertices: JobVertex[]
  edges: JobEdge[]
}

/** A root-cause exception thrown by a Flink job. */
export type JobException = {
  timestamp: Date
  name: string
  message: string
  stacktrace: string
  /** Task that threw the exception, or null for job-level failures. */
  taskName: string | null
  /** Host/location where the exception occurred. */
  location: string | null
}

/** Lifecycle status of a single checkpoint. */
export type CheckpointStatus = "COMPLETED" | "IN_PROGRESS" | "FAILED"

/** A single checkpoint or savepoint snapshot. */
export type Checkpoint = {
  id: number
  status: CheckpointStatus
  triggerTimestamp: Date
  /** Duration in milliseconds. */
  duration: number
  /** Total state size in bytes. */
  size: number
  /** Size of the checkpointed data in bytes (may differ from full state size). */
  checkpointedSize?: number
  /** Amount of data processed during checkpointing in bytes. */
  processedData: number
  isSavepoint: boolean
}

/** Aggregate counts of checkpoints by status. */
export type CheckpointCounts = {
  completed: number
  failed: number
  inProgress: number
  total: number
  triggered?: number
  restored?: number
}

/** Checkpoint configuration from the Flink job. */
export type CheckpointConfig = {
  mode: "EXACTLY_ONCE" | "AT_LEAST_ONCE"
  /** Checkpoint interval in milliseconds. */
  interval: number
  /** Checkpoint timeout in milliseconds. */
  timeout: number
  /** Minimum pause between checkpoints in milliseconds. */
  minPause: number
  maxConcurrent: number
  externalization?: {
    enabled: boolean
    deleteOnCancellation: boolean
  }
  unalignedCheckpoints?: boolean
}

/** Per-subtask metrics for a vertex, used in data-skew analysis. */
export type SubtaskMetrics = {
  subtaskIndex: number
  status: string
  attempt: number
  /** Host endpoint where this subtask runs. */
  endpoint: string
  taskManagerId: string
  /** Epoch milliseconds. */
  startTime: number
  /** Epoch milliseconds. */
  endTime: number
  /** Duration in milliseconds. */
  duration: number
  recordsIn: number
  recordsOut: number
  bytesIn: number
  bytesOut: number
  busyTimeMsPerSecond: number
  backPressuredTimeMsPerSecond: number
  idleTimeMsPerSecond: number
}

/** Watermark value for a single subtask of a vertex. */
export type VertexWatermark = {
  subtaskIndex: number
  /** Watermark as epoch milliseconds, or -Infinity sentinel for no watermark. */
  watermark: number
}

/** Back-pressure metrics for a single subtask. */
export type SubtaskBackPressure = {
  subtaskIndex: number
  level: "ok" | "low" | "high"
  /** Back-pressure ratio (0.0–1.0). */
  ratio: number
  /** Busy ratio (0.0–1.0). */
  busyRatio: number
  /** Idle ratio (0.0–1.0). */
  idleRatio: number
}

/** Aggregated back-pressure status for a vertex across all subtasks. */
export type VertexBackPressure = {
  level: "ok" | "low" | "high"
  /** Epoch milliseconds when the measurement was taken. */
  endTimestamp: number
  subtasks: SubtaskBackPressure[]
}

/** User-defined accumulator exposed by a Flink job. */
export type UserAccumulator = {
  name: string
  type: string
  value: string
}

/** A single key-value configuration entry for a Flink job. */
export type JobConfiguration = {
  key: string
  value: string
}

// --- Connector detection types ---

/** Known connector types detected from vertex names or TAP manifests. */
export type ConnectorType =
  | "kafka"
  | "iceberg"
  | "paimon"
  | "jdbc"
  | "filesystem"
  | "unknown"

/** Role of a connector in the job graph. */
export type ConnectorRole = "source" | "sink"

/** I/O metrics for a detected connector. */
export type ConnectorMetrics = {
  recordsRead: number
  recordsWritten: number
  bytesRead: number
  bytesWritten: number
}

/** A detected source or sink connector in a Flink job. */
export type JobConnector = {
  vertexId: string
  vertexName: string
  connectorType: ConnectorType
  role: ConnectorRole
  /** Resource identifier (e.g. Kafka topic, JDBC URL, file path). */
  resource: string
  /** Confidence score (0.0–1.0) of the detection. */
  confidence: number
  /** Method used to detect the connector. */
  detectionMethod: "manifest" | "vertex_name" | "plan_node"
  metrics: ConnectorMetrics | null
}

/** Full detail of a Flink job, including graph, metrics, checkpoints, and configuration. */
export type FlinkJob = {
  id: string
  name: string
  status: JobStatus
  startTime: Date
  endTime: Date | null
  /** Duration in milliseconds. */
  duration: number
  tasks: TaskCounts
  parallelism: number
  plan: JobPlan | null
  exceptions: JobException[]
  checkpoints: Checkpoint[]
  checkpointCounts: CheckpointCounts | null
  checkpointConfig: CheckpointConfig | null
  checkpointLatest: CheckpointLatest | null
  /** Per-vertex subtask metrics, keyed by vertex ID. */
  subtaskMetrics: Record<string, SubtaskMetrics[]>
  configuration: JobConfiguration[]
  /** Per-vertex watermark values, keyed by vertex ID. */
  watermarks: Record<string, VertexWatermark[]>
  /** Per-vertex back-pressure status, keyed by vertex ID. */
  backpressure: Record<string, VertexBackPressure>
  /** Per-vertex user accumulators, keyed by vertex ID. */
  accumulators: Record<string, UserAccumulator[]>
  sourcesAndSinks: JobConnector[]
}

// --- Task Manager types ---

/** Garbage collector statistics from the JVM. */
export type GarbageCollectorInfo = {
  name: string
  /** Total number of collections. */
  count: number
  /** Total time spent in GC in milliseconds. */
  time: number
}

/** Live JVM and system metrics for a Task Manager. */
export type TaskManagerMetrics = {
  /** CPU usage ratio (0.0–1.0). */
  cpuUsage: number
  // JVM heap
  heapUsed: number
  heapCommitted: number
  heapMax: number
  // JVM non-heap
  nonHeapUsed: number
  nonHeapCommitted: number
  nonHeapMax: number
  // Direct / mapped buffers
  directCount: number
  directUsed: number
  directMax: number
  mappedCount: number
  mappedUsed: number
  mappedMax: number
  // Netty shuffle memory
  nettyShuffleMemoryAvailable: number
  nettyShuffleMemoryUsed: number
  nettyShuffleMemoryTotal: number
  nettyShuffleSegmentsAvailable: number
  nettyShuffleSegmentsUsed: number
  nettyShuffleSegmentsTotal: number
  // Managed / network (from metrics endpoint)
  managedMemoryUsed: number
  managedMemoryTotal: number
  // Metaspace
  metaspaceUsed: number
  metaspaceMax: number
  // Garbage collectors
  garbageCollectors: GarbageCollectorInfo[]
  // Thread count
  threadCount: number
}

/** Flink memory model — effective configuration in bytes. */
export type TaskManagerMemoryConfiguration = {
  frameworkHeap: number
  taskHeap: number
  frameworkOffHeap: number
  taskOffHeap: number
  networkMemory: number
  managedMemory: number
  jvmMetaspace: number
  jvmOverhead: number
  totalFlinkMemory: number
  totalProcessMemory: number
}

/** Resource profile for total/free resource accounting. */
export type TaskManagerResource = {
  cpuCores: number
  taskHeapMemory: number
  taskOffHeapMemory: number
  managedMemory: number
  networkMemory: number
}

/** A task slot allocated to a specific job on a Task Manager. */
export type AllocatedSlot = {
  index: number
  jobId: string
  resource: TaskManagerResource
}

/** A Flink Task Manager instance with hardware info, slots, metrics, and tab data. */
export type TaskManager = {
  id: string
  path: string
  dataPort: number
  jmxPort: number
  lastHeartbeat: Date
  slotsTotal: number
  slotsFree: number
  // Hardware
  cpuCores: number
  physicalMemory: number
  freeMemory: number
  // Resource accounting
  totalResource: TaskManagerResource
  freeResource: TaskManagerResource
  // Memory model
  memoryConfiguration: TaskManagerMemoryConfiguration
  // Allocated slots
  allocatedSlots: AllocatedSlot[]
  // Live metrics
  metrics: TaskManagerMetrics
  // Tab data (mirrors Flink REST /taskmanagers/:id/* endpoints)
  logs: string
  stdout: string
  logFiles: LogFileEntry[]
  threadDump: ThreadDumpInfo
}

// --- Job Manager types ---

/** A single key-value configuration entry for the Job Manager. */
export type JobManagerConfig = {
  key: string
  value: string
}

/** A timestamped JVM metric sample for time-series charts. */
export type JvmMetricSample = {
  timestamp: Date
  value: number
}

/** Aggregated JVM metrics for the Job Manager, each as a time series. */
export type JobManagerMetrics = {
  jvmHeapUsed: JvmMetricSample[]
  jvmHeapMax: number
  jvmNonHeapUsed: JvmMetricSample[]
  jvmNonHeapMax: number
  threadCount: JvmMetricSample[]
  gcCount: JvmMetricSample[]
  gcTime: JvmMetricSample[]
}

/** JVM memory configuration snapshot (current usage and limits). */
export type JvmMemoryConfig = {
  heapMax: number
  heapUsed: number
  nonHeapMax: number
  nonHeapUsed: number
  metaspaceMax: number
  metaspaceUsed: number
  directMax: number
  directUsed: number
}

/** JVM runtime information — arguments, system properties, and memory config. */
export type JvmInfo = {
  arguments: string[]
  systemProperties: { key: string; value: string }[]
  memoryConfig: JvmMemoryConfig
}

/** A JAR file entry on the Job Manager's classpath. */
export type ClasspathEntry = {
  path: string
  filename: string
  /** File size in bytes. */
  size: number
  /** Classification tag (e.g. "flink", "user", "hadoop"). */
  tag: string
}

/** A log file available for download from a Task Manager or Job Manager. */
export type LogFileEntry = {
  name: string
  lastModified: Date
  /** File size in kilobytes. */
  size: number
}

/** Contents of a downloaded log file. */
export type LogFileContent = {
  name: string
  content: string
}

// --- Thread dump types ---

/** JVM thread state as reported by the Flink REST API. */
export type ThreadState =
  | "RUNNABLE"
  | "WAITING"
  | "TIMED_WAITING"
  | "BLOCKED"
  | "NEW"
  | "TERMINATED"

/** Raw API response entry — one per thread, as returned by Flink REST API. */
export type ThreadInfoRaw = {
  threadName: string
  stringifiedThreadInfo: string
}

/** Parsed thread entry — structured form the UI renders. */
export type ThreadDumpEntry = {
  name: string
  id: number
  state: ThreadState
  lockObject: string | null
  isNative: boolean
  stackFrames: string[]
  lockedSynchronizers: string[]
}

/** Container for raw thread dump data from the Flink REST API. */
export type ThreadDumpInfo = {
  threadInfos: ThreadInfoRaw[]
}

/** Full Job Manager detail including config, metrics, JVM info, logs, and thread dumps. */
export type JobManagerInfo = {
  config: JobManagerConfig[]
  metrics: JobManagerMetrics
  logs: string
  stdout: string
  jvm: JvmInfo
  classpath: ClasspathEntry[]
  logFiles: LogFileEntry[]
  threadDump: ThreadDumpInfo
}

// --- Cluster overview types ---

/** Cluster-wide overview statistics from the Flink REST /overview endpoint. */
export type ClusterOverview = {
  flinkVersion: string
  flinkCommitId: string
  totalTaskSlots: number
  availableTaskSlots: number
  runningJobs: number
  finishedJobs: number
  cancelledJobs: number
  failedJobs: number
  taskManagerCount: number
  /** Advertised cluster capabilities (e.g. "web-submit"). */
  capabilities: string[]
}

// --- Feature flags ---

/** Feature flags controlling which UI actions are available in this Flink cluster. */
export type FlinkFeatureFlags = {
  webSubmit: boolean
  webCancel: boolean
  webRescale: boolean
  webHistory: boolean
  webProfiler: boolean
}

// --- Submit Job types ---

/** A JAR file uploaded to the Flink cluster for job submission. */
export type UploadedJar = {
  id: string
  name: string
  uploadTime: Date
  entryClasses: string[]
}

/** Parameters for submitting a Flink job from an uploaded JAR. */
export type SubmitJobRequest = {
  jarId: string
  entryClass: string
  parallelism: number
  programArgs: string
  /** Savepoint path to restore from, or null for a fresh start. */
  savepointPath: string | null
  allowNonRestoredState: boolean
}

// --- Checkpoint detail types ---

/** Min/max/average summary for a checkpoint metric across subtasks. */
export type CheckpointMinMaxAvg = {
  min: number
  max: number
  avg: number
}

/** Summary statistics for a checkpoint across all subtasks of a vertex. */
export type CheckpointTaskSummary = {
  endToEndDuration?: CheckpointMinMaxAvg
  stateSize?: CheckpointMinMaxAvg
  checkpointedSize?: CheckpointMinMaxAvg
  syncDuration?: CheckpointMinMaxAvg
  asyncDuration?: CheckpointMinMaxAvg
  alignmentDuration?: CheckpointMinMaxAvg
  startDelay?: CheckpointMinMaxAvg
}

/** Checkpoint detail for a single vertex (operator) in the job. */
export type CheckpointTaskDetail = {
  vertexId: string
  status: string
  /** Epoch milliseconds of the latest subtask acknowledgment. */
  latestAckTimestamp: number
  /** State size in bytes. */
  stateSize: number
  /** End-to-end duration in milliseconds. */
  endToEndDuration: number
  numSubtasks: number
  numAcknowledgedSubtasks: number
  checkpointedSize?: number
  processedData?: number
  persistedData?: number
  summary?: CheckpointTaskSummary
}

/** Full detail of a single checkpoint, including per-vertex breakdown. */
export type CheckpointDetail = {
  id: number
  status: CheckpointStatus
  isSavepoint: boolean
  triggerTimestamp: Date
  latestAckTimestamp: Date
  /** Total state size in bytes. */
  stateSize: number
  /** End-to-end duration in milliseconds. */
  endToEndDuration: number
  numSubtasks: number
  numAcknowledgedSubtasks: number
  /** Per-vertex checkpoint details, keyed by vertex ID. */
  tasks: Record<string, CheckpointTaskDetail>
  checkpointType?: string
  externalPath?: string
  discarded?: boolean
  checkpointedSize?: number
  processedData?: number
  persistedData?: number
}

/** Per-subtask checkpoint statistics for detailed analysis. */
export type CheckpointSubtaskStats = {
  subtaskIndex: number
  /** Epoch milliseconds. */
  ackTimestamp: number
  /** End-to-end duration in milliseconds. */
  endToEndDuration: number
  /** State size in bytes. */
  stateSize: number
  /** Checkpointed data size in bytes. */
  checkpointedSize: number
  /** Synchronous snapshot duration in milliseconds. */
  syncDuration: number
  /** Asynchronous snapshot duration in milliseconds. */
  asyncDuration: number
  /** Processed data in bytes. */
  processedData: number
  /** Barrier alignment duration in milliseconds. */
  alignmentDuration: number
  /** Delay from trigger to start in milliseconds. */
  startDelay: number
  unalignedCheckpoint: boolean
}

/** The most recent checkpoints by category (completed, failed, savepoint, restore). */
export type CheckpointLatest = {
  latestCompleted?: Checkpoint | null
  latestFailed?: Checkpoint | null
  latestSavepoint?: Checkpoint | null
  latestRestore?: {
    id: number
    restoreTimestamp: Date
    isSavepoint: boolean
    externalPath?: string
  } | null
}

// --- Subtask timeline types ---

/** Timeline entry for a single subtask showing phase timestamps. */
export type SubtaskTimelineEntry = {
  subtask: number
  host: string
  /** Duration in milliseconds. */
  duration: number
  /** Phase timestamps keyed by phase name (epoch ms). */
  timestamps: Record<string, number>
}

/** Subtask timeline for a vertex, used to render Gantt-style execution charts. */
export type SubtaskTimeline = {
  vertexId: string
  vertexName: string
  /** Current time as epoch milliseconds. */
  now: number
  subtasks: SubtaskTimelineEntry[]
}

// --- Flamegraph types ---

/** A node in the flamegraph tree representing a stack frame. */
export type FlamegraphNode = {
  name: string
  /** Sample count or time value for this frame. */
  value: number
  children: FlamegraphNode[]
}

/** Flamegraph profiling data from the Flink REST API. */
export type FlamegraphData = {
  /** Epoch milliseconds when the profiling ended. */
  endTimestamp: number
  root: FlamegraphNode
}
