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
  recordsIn: number;
  recordsOut: number;
  bytesIn: number;
  bytesOut: number;
  busyTimeMsPerSecond: number;
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
};

// --- Task Manager types ---

export type TaskManagerMetrics = {
  cpuUsage: number;
  jvmHeapUsed: number;
  jvmHeapMax: number;
  jvmNonHeapUsed: number;
  jvmNonHeapMax: number;
  managedMemoryUsed: number;
  managedMemoryTotal: number;
  networkMemoryUsed: number;
  networkMemoryTotal: number;
  gcCount: number;
  gcTime: number;
  threadCount: number;
};

export type TaskManager = {
  id: string;
  path: string;
  dataPort: number;
  lastHeartbeat: Date;
  slotsTotal: number;
  slotsFree: number;
  cpuCores: number;
  physicalMemory: number;
  jvmHeapSize: number;
  managedMemory: number;
  networkMemory: number;
  metrics: TaskManagerMetrics;
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

export type JobManagerInfo = {
  config: JobManagerConfig[];
  metrics: JobManagerMetrics;
  logs: string;
  stdout: string;
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
