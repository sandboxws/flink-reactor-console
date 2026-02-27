// ---------------------------------------------------------------------------
// Cluster domain types — shared across Overview, Jobs, TM, JM, Submit pages
// ---------------------------------------------------------------------------

// --- Job types ---

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
  | "RECONCILING";

export type TaskStatus =
  | "pending"
  | "running"
  | "finished"
  | "canceling"
  | "failed";

export type TaskCounts = Record<TaskStatus, number>;

// --- Job detail types ---

export type JobVertexStatus = "RUNNING" | "FINISHED" | "FAILED" | "CANCELED" | "CREATED";

export type JobVertexMetrics = {
  recordsIn: number;
  recordsOut: number;
  bytesIn: number;
  bytesOut: number;
  busyTimeMsPerSecond: number;
  backPressuredTimeMsPerSecond: number;
};

export type JobVertex = {
  id: string;
  name: string;
  parallelism: number;
  status: JobVertexStatus;
  metrics: JobVertexMetrics;
  tasks: TaskCounts;
  duration: number;
  startTime: number;
};

export type ShipStrategy =
  | "FORWARD"
  | "HASH"
  | "REBALANCE"
  | "BROADCAST"
  | "RESCALE"
  | "GLOBAL";

export type JobEdge = {
  source: string;
  target: string;
  shipStrategy: ShipStrategy;
};

export type JobPlan = {
  vertices: JobVertex[];
  edges: JobEdge[];
};

export type JobException = {
  timestamp: Date;
  name: string;
  message: string;
  stacktrace: string;
  taskName: string | null;
  location: string | null;
};

export type CheckpointStatus =
  | "COMPLETED"
  | "IN_PROGRESS"
  | "FAILED";

export type Checkpoint = {
  id: number;
  status: CheckpointStatus;
  triggerTimestamp: Date;
  duration: number;
  size: number;
  processedData: number;
  isSavepoint: boolean;
};

export type CheckpointConfig = {
  mode: "EXACTLY_ONCE" | "AT_LEAST_ONCE";
  interval: number;
  timeout: number;
  minPause: number;
  maxConcurrent: number;
};

export type SubtaskMetrics = {
  subtaskIndex: number;
  status: string;
  attempt: number;
  endpoint: string;
  taskManagerId: string;
  startTime: number;
  endTime: number;
  duration: number;
  recordsIn: number;
  recordsOut: number;
  bytesIn: number;
  bytesOut: number;
  busyTimeMsPerSecond: number;
  backPressuredTimeMsPerSecond: number;
  idleTimeMsPerSecond: number;
};

export type VertexWatermark = {
  subtaskIndex: number;
  watermark: number; // epoch ms, or -Infinity sentinel
};

export type SubtaskBackPressure = {
  subtaskIndex: number;
  level: "ok" | "low" | "high";
  ratio: number;
  busyRatio: number;
  idleRatio: number;
};

export type VertexBackPressure = {
  level: "ok" | "low" | "high";
  endTimestamp: number;
  subtasks: SubtaskBackPressure[];
};

export type UserAccumulator = {
  name: string;
  type: string;
  value: string;
};

export type JobConfiguration = {
  key: string;
  value: string;
};

export type FlinkJob = {
  id: string;
  name: string;
  status: JobStatus;
  startTime: Date;
  endTime: Date | null;
  duration: number;
  tasks: TaskCounts;
  parallelism: number;
  plan: JobPlan | null;
  exceptions: JobException[];
  checkpoints: Checkpoint[];
  checkpointConfig: CheckpointConfig | null;
  subtaskMetrics: Record<string, SubtaskMetrics[]>;
  configuration: JobConfiguration[];
  watermarks: Record<string, VertexWatermark[]>;
  backpressure: Record<string, VertexBackPressure>;
  accumulators: Record<string, UserAccumulator[]>;
};

// --- Task Manager types ---

export type GarbageCollectorInfo = {
  name: string;
  count: number;
  time: number;
};

export type TaskManagerMetrics = {
  cpuUsage: number;
  // JVM heap
  heapUsed: number;
  heapCommitted: number;
  heapMax: number;
  // JVM non-heap
  nonHeapUsed: number;
  nonHeapCommitted: number;
  nonHeapMax: number;
  // Direct / mapped buffers
  directCount: number;
  directUsed: number;
  directMax: number;
  mappedCount: number;
  mappedUsed: number;
  mappedMax: number;
  // Netty shuffle memory
  nettyShuffleMemoryAvailable: number;
  nettyShuffleMemoryUsed: number;
  nettyShuffleMemoryTotal: number;
  nettyShuffleSegmentsAvailable: number;
  nettyShuffleSegmentsUsed: number;
  nettyShuffleSegmentsTotal: number;
  // Managed / network (from metrics endpoint)
  managedMemoryUsed: number;
  managedMemoryTotal: number;
  // Metaspace
  metaspaceUsed: number;
  metaspaceMax: number;
  // Garbage collectors
  garbageCollectors: GarbageCollectorInfo[];
  // Thread count
  threadCount: number;
};

/** Flink memory model — effective configuration in bytes */
export type TaskManagerMemoryConfiguration = {
  frameworkHeap: number;
  taskHeap: number;
  frameworkOffHeap: number;
  taskOffHeap: number;
  networkMemory: number;
  managedMemory: number;
  jvmMetaspace: number;
  jvmOverhead: number;
  totalFlinkMemory: number;
  totalProcessMemory: number;
};

/** Resource profile for total/free resource accounting */
export type TaskManagerResource = {
  cpuCores: number;
  taskHeapMemory: number;
  taskOffHeapMemory: number;
  managedMemory: number;
  networkMemory: number;
};

export type AllocatedSlot = {
  index: number;
  jobId: string;
  resource: TaskManagerResource;
};

export type TaskManager = {
  id: string;
  path: string;
  dataPort: number;
  jmxPort: number;
  lastHeartbeat: Date;
  slotsTotal: number;
  slotsFree: number;
  // Hardware
  cpuCores: number;
  physicalMemory: number;
  freeMemory: number;
  // Resource accounting
  totalResource: TaskManagerResource;
  freeResource: TaskManagerResource;
  // Memory model
  memoryConfiguration: TaskManagerMemoryConfiguration;
  // Allocated slots
  allocatedSlots: AllocatedSlot[];
  // Live metrics
  metrics: TaskManagerMetrics;
  // Tab data (mirrors Flink REST /taskmanagers/:id/* endpoints)
  logs: string;
  stdout: string;
  logFiles: LogFileEntry[];
  threadDump: ThreadDumpInfo;
};

// --- Job Manager types ---

export type JobManagerConfig = {
  key: string;
  value: string;
};

export type JvmMetricSample = {
  timestamp: Date;
  value: number;
};

export type JobManagerMetrics = {
  jvmHeapUsed: JvmMetricSample[];
  jvmHeapMax: number;
  jvmNonHeapUsed: JvmMetricSample[];
  jvmNonHeapMax: number;
  threadCount: JvmMetricSample[];
  gcCount: JvmMetricSample[];
  gcTime: JvmMetricSample[];
};

export type JvmMemoryConfig = {
  heapMax: number;
  heapUsed: number;
  nonHeapMax: number;
  nonHeapUsed: number;
  metaspaceMax: number;
  metaspaceUsed: number;
  directMax: number;
  directUsed: number;
};

export type JvmInfo = {
  arguments: string[];
  systemProperties: { key: string; value: string }[];
  memoryConfig: JvmMemoryConfig;
};

export type ClasspathEntry = {
  path: string;
  filename: string;
  size: number;
  tag: string;
};

export type LogFileEntry = {
  name: string;
  lastModified: Date;
  size: number; // KB
};

export type LogFileContent = {
  name: string;
  content: string;
};

// --- Thread dump types ---

export type ThreadState =
  | "RUNNABLE"
  | "WAITING"
  | "TIMED_WAITING"
  | "BLOCKED"
  | "NEW"
  | "TERMINATED";

/** Raw API response entry — one per thread, as returned by Flink REST API */
export type ThreadInfoRaw = {
  threadName: string;
  stringifiedThreadInfo: string;
};

/** Parsed thread entry — structured form the UI renders */
export type ThreadDumpEntry = {
  name: string;
  id: number;
  state: ThreadState;
  lockObject: string | null;
  isNative: boolean;
  stackFrames: string[];
  lockedSynchronizers: string[];
};

export type ThreadDumpInfo = {
  threadInfos: ThreadInfoRaw[];
};

export type JobManagerInfo = {
  config: JobManagerConfig[];
  metrics: JobManagerMetrics;
  logs: string;
  stdout: string;
  jvm: JvmInfo;
  classpath: ClasspathEntry[];
  logFiles: LogFileEntry[];
  threadDump: ThreadDumpInfo;
};

// --- Cluster overview types ---

export type ClusterOverview = {
  flinkVersion: string;
  flinkCommitId: string;
  totalTaskSlots: number;
  availableTaskSlots: number;
  runningJobs: number;
  finishedJobs: number;
  cancelledJobs: number;
  failedJobs: number;
  taskManagerCount: number;
};

// --- Feature flags ---

export type FlinkFeatureFlags = {
  webSubmit: boolean;
  webCancel: boolean;
  webRescale: boolean;
  webHistory: boolean;
  webProfiler: boolean;
};

// --- Submit Job types ---

export type UploadedJar = {
  id: string;
  name: string;
  uploadTime: Date;
  entryClasses: string[];
};

export type SubmitJobRequest = {
  jarId: string;
  entryClass: string;
  parallelism: number;
  programArgs: string;
  savepointPath: string | null;
  allowNonRestoredState: boolean;
};

// --- Checkpoint detail types ---

export type CheckpointTaskDetail = {
  vertexId: string;
  status: string;
  latestAckTimestamp: number;
  stateSize: number;
  endToEndDuration: number;
  numSubtasks: number;
  numAcknowledgedSubtasks: number;
};

export type CheckpointDetail = {
  id: number;
  status: CheckpointStatus;
  isSavepoint: boolean;
  triggerTimestamp: Date;
  latestAckTimestamp: Date;
  stateSize: number;
  endToEndDuration: number;
  numSubtasks: number;
  numAcknowledgedSubtasks: number;
  tasks: Record<string, CheckpointTaskDetail>;
};

// --- Subtask timeline types ---

export type SubtaskTimelineEntry = {
  subtask: number;
  host: string;
  duration: number;
  timestamps: Record<string, number>;
};

export type SubtaskTimeline = {
  vertexId: string;
  vertexName: string;
  now: number;
  subtasks: SubtaskTimelineEntry[];
};

// --- Flamegraph types ---

export type FlamegraphNode = {
  name: string;
  value: number;
  children: FlamegraphNode[];
};

export type FlamegraphData = {
  endTimestamp: number;
  root: FlamegraphNode;
};
