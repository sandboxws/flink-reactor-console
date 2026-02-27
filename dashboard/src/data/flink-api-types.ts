// ---------------------------------------------------------------------------
// Flink REST API response types — raw JSON shapes with hyphenated keys
// These mirror the exact API responses; mappers convert them to domain types.
// ---------------------------------------------------------------------------

/**
 * GET /overview
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#overview-1
 */
export interface FlinkOverviewResponse {
  "flink-version": string;
  "flink-commit": string;
  "slots-total": number;
  "slots-available": number;
  "jobs-running": number;
  "jobs-finished": number;
  "jobs-cancelled": number;
  "jobs-failed": number;
  taskmanagers: number;
}

/**
 * Task counts object within each job entry — 10 Flink-native states.
 */
export interface FlinkTaskCounts {
  created: number;
  scheduled: number;
  deploying: number;
  running: number;
  finished: number;
  canceling: number;
  canceled: number;
  failed: number;
  reconciling: number;
  initializing: number;
}

/**
 * Single job entry within the GET /jobs/overview response.
 */
export interface FlinkJobOverviewEntry {
  jid: string;
  name: string;
  state: string;
  "start-time": number;
  "end-time": number;
  duration: number;
  "last-modification": number;
  tasks: FlinkTaskCounts;
}

/**
 * GET /jobs/overview
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-overview
 */
export interface FlinkJobsOverviewResponse {
  jobs: FlinkJobOverviewEntry[];
}

// ---------------------------------------------------------------------------
// Job detail types — GET /jobs/:jobid and related endpoints
// ---------------------------------------------------------------------------

/**
 * Input edge within a plan node (plan.nodes[].inputs[]).
 */
export interface FlinkPlanNodeInput {
  num: number;
  id: string;
  ship_strategy: string;
  exchange: string;
}

/**
 * Single node within the execution plan.
 */
export interface FlinkPlanNode {
  id: string;
  parallelism: number;
  operator: string;
  operator_strategy: string;
  description: string;
  inputs?: FlinkPlanNodeInput[];
}

/**
 * Execution plan returned within GET /jobs/:jobid.
 */
export interface FlinkJobPlan {
  jid: string;
  name: string;
  type: string;
  nodes: FlinkPlanNode[];
}

/**
 * Vertex metrics within GET /jobs/:jobid → vertices[].
 */
export interface FlinkVertexMetrics {
  "read-bytes": number;
  "read-bytes-complete": boolean;
  "write-bytes": number;
  "write-bytes-complete": boolean;
  "read-records": number;
  "read-records-complete": boolean;
  "write-records": number;
  "write-records-complete": boolean;
  "accumulated-backpressured-time": number;
  "accumulated-idle-time": number;
  "accumulated-busy-time": number;
}

/**
 * Single vertex entry within GET /jobs/:jobid → vertices[].
 * Task counts use UPPERCASE keys (unlike FlinkTaskCounts which uses lowercase).
 */
export interface FlinkVertexInfo {
  id: string;
  name: string;
  maxParallelism: number;
  parallelism: number;
  status: string;
  "start-time": number;
  "end-time": number;
  duration: number;
  tasks: Record<string, number>;
  metrics: FlinkVertexMetrics;
}

/**
 * GET /jobs/:jobid
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-jobid
 */
export interface FlinkJobDetailResponse {
  jid: string;
  name: string;
  state: string;
  "start-time": number;
  "end-time": number;
  duration: number;
  now: number;
  timestamps: Record<string, number>;
  vertices: FlinkVertexInfo[];
  "status-counts": Record<string, number>;
  plan: FlinkJobPlan;
}

/**
 * Single exception entry within exceptionHistory.entries[].
 * Uses camelCase field names (Flink 1.20+ format).
 */
export interface FlinkExceptionEntry {
  exceptionName: string;
  stacktrace: string;
  timestamp: number;
  taskName: string | null;
  endpoint: string | null;
  taskManagerId: string | null;
  failureLabels: Record<string, string>;
}

/**
 * GET /jobs/:jobid/exceptions
 * Flink 1.20+ uses exceptionHistory (all-exceptions was removed).
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-jobid-exceptions
 */
export interface FlinkJobExceptionsResponse {
  exceptionHistory: {
    entries: FlinkExceptionEntry[];
    truncated: boolean;
  };
}

/**
 * Single checkpoint entry within GET /jobs/:jobid/checkpoints → history[].
 */
export interface FlinkCheckpointHistoryEntry {
  id: number;
  status: string;
  is_savepoint: boolean;
  trigger_timestamp: number;
  latest_ack_timestamp: number;
  state_size: number;
  end_to_end_duration: number;
  processed_data: number;
  persisted_data: number;
  num_subtasks: number;
  num_acknowledged_subtasks: number;
}

/**
 * GET /jobs/:jobid/checkpoints
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-jobid-checkpoints
 */
export interface FlinkCheckpointingStatistics {
  counts: Record<string, number>;
  history: FlinkCheckpointHistoryEntry[];
}

/**
 * GET /jobs/:jobid/checkpoints/config
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-jobid-checkpoints-config
 */
export interface FlinkCheckpointConfigResponse {
  mode: string;
  interval: number;
  timeout: number;
  min_pause: number;
  max_concurrent: number;
  externalization: {
    enabled: boolean;
    delete_on_cancellation: boolean;
  };
  unaligned_checkpoints: boolean;
}

/**
 * GET /jobs/:jobid/config
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-jobid-config-1
 */
export interface FlinkJobConfigResponse {
  jid: string;
  name: string;
  "execution-config": {
    "execution-mode": string;
    "restart-strategy": string;
    "job-parallelism": number;
    "object-reuse-mode": boolean;
    "user-config": Record<string, string>;
  };
}

/**
 * Single subtask entry within GET /jobs/:jobid/vertices/:vid.
 * Uses full IOMetricsInfo for metrics.
 */
export interface FlinkSubtaskInfo {
  subtask: number;
  status: string;
  attempt: number;
  endpoint: string;
  "start-time": number;
  "end-time": number;
  duration: number;
  metrics: FlinkVertexMetrics;
  "taskmanager-id": string;
}

/**
 * GET /jobs/:jobid/vertices/:vid
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-jobid-vertices-vertexid
 */
export interface FlinkVertexDetailResponse {
  id: string;
  name: string;
  parallelism: number;
  now: number;
  subtasks: FlinkSubtaskInfo[];
}

// ---------------------------------------------------------------------------
// Per-vertex endpoint types — watermarks, backpressure, accumulators
// ---------------------------------------------------------------------------

/**
 * GET /jobs/:jobid/vertices/:vertexid/watermarks
 * Flink serializes this as a bare JSON array (MetricCollectionResponseBody).
 */
export type FlinkWatermarkMetric = { id: string; value: string };
export type FlinkWatermarksResponse = FlinkWatermarkMetric[];

/**
 * Single subtask backpressure entry within the backpressure response.
 */
export interface FlinkSubtaskBackPressureInfo {
  subtask: number;
  "attempt-number": number;
  backpressureLevel: "ok" | "low" | "high";
  ratio: number;
  busyRatio: number;
  idleRatio: number;
}

/**
 * GET /jobs/:jobid/vertices/:vertexid/backpressure
 */
export interface FlinkVertexBackPressureResponse {
  status: "deprecated" | "ok";
  backpressureLevel: "ok" | "low" | "high";
  "end-timestamp": number;
  subtasks: FlinkSubtaskBackPressureInfo[];
}

/**
 * Single user accumulator entry.
 */
export interface FlinkUserAccumulator {
  name: string;
  type: string;
  value: string;
}

/**
 * GET /jobs/:jobid/vertices/:vertexid/accumulators
 */
export interface FlinkVertexAccumulatorsResponse {
  id: string;
  "user-accumulators": FlinkUserAccumulator[];
}

/**
 * Aggregate envelope combining all job detail endpoint responses.
 * Assembled by the proxy route, consumed by the browser-side mapper.
 */
export interface FlinkJobDetailAggregate {
  job: FlinkJobDetailResponse;
  exceptions: FlinkJobExceptionsResponse;
  checkpoints: FlinkCheckpointingStatistics;
  checkpointConfig: FlinkCheckpointConfigResponse;
  jobConfig: FlinkJobConfigResponse;
  vertexDetails: Record<string, FlinkVertexDetailResponse>;
  watermarks: Record<string, FlinkWatermarksResponse>;
  backpressure: Record<string, FlinkVertexBackPressureResponse>;
  accumulators: Record<string, FlinkVertexAccumulatorsResponse>;
}

// ---------------------------------------------------------------------------
// Task Manager types — GET /taskmanagers and related endpoints
// ---------------------------------------------------------------------------

/**
 * Hardware description within a task manager entry.
 */
export interface FlinkTaskManagerHardware {
  cpuCores: number;
  physicalMemory: number;
  freeMemory: number;
  managedMemory: number;
}

/**
 * Resource profile (total/free) within a task manager entry.
 */
export interface FlinkTaskManagerResourceProfile {
  cpuCores: number;
  taskHeapMemory: number;
  taskOffHeapMemory: number;
  managedMemory: number;
  networkMemory: number;
}

/**
 * Memory configuration within task manager detail.
 */
export interface FlinkTaskManagerMemoryConfiguration {
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
}

/**
 * Allocated slot info within task manager detail.
 */
export interface FlinkAllocatedSlot {
  index: number;
  jobId: string;
  resource: FlinkTaskManagerResourceProfile;
}

/**
 * Single task manager entry within GET /taskmanagers response.
 */
export interface FlinkTaskManagerItem {
  id: string;
  path: string;
  dataPort: number;
  jmxPort: number;
  timeSinceLastHeartbeat: number;
  slotsNumber: number;
  freeSlots: number;
  totalResource: FlinkTaskManagerResourceProfile;
  freeResource: FlinkTaskManagerResourceProfile;
  hardware: FlinkTaskManagerHardware;
  memoryConfiguration: FlinkTaskManagerMemoryConfiguration;
  allocatedSlots: FlinkAllocatedSlot[];
}

/**
 * GET /taskmanagers
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#taskmanagers
 */
export interface FlinkTaskManagersResponse {
  taskmanagers: FlinkTaskManagerItem[];
}

/**
 * GET /taskmanagers/:tmid — same shape as FlinkTaskManagerItem but standalone
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#taskmanagers-taskmanagerid
 */
export type FlinkTaskManagerDetailResponse = FlinkTaskManagerItem;

/**
 * Reusable metric entry — GET /taskmanagers/:tmid/metrics?get=... or /jobmanager/metrics?get=...
 */
export interface FlinkMetricItem {
  id: string;
  value: string;
}

/**
 * GET /taskmanagers/:tmid/thread-dump or /jobmanager/thread-dump
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#taskmanagers-taskmanagerid-thread-dump
 */
export interface FlinkThreadDumpResponse {
  threadInfos: Array<{
    threadName: string;
    stringifiedThreadInfo: string;
  }>;
}

/**
 * Single log file entry in the log list response.
 */
export interface FlinkLogFileInfo {
  name: string;
  size: number;
}

/**
 * GET /taskmanagers/:tmid/logs or /jobmanager/logs
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#taskmanagers-taskmanagerid-logs
 */
export interface FlinkLogListResponse {
  logs: FlinkLogFileInfo[];
}

// ---------------------------------------------------------------------------
// Task Manager detail aggregate — assembled by the proxy route
// ---------------------------------------------------------------------------

/**
 * Aggregate envelope for task manager detail.
 * Combines the TM detail + metrics in a single response.
 */
export interface FlinkTaskManagerDetailAggregate {
  detail: FlinkTaskManagerDetailResponse;
  metrics: FlinkMetricItem[];
}

// ---------------------------------------------------------------------------
// Job Manager types — GET /jobmanager/* endpoints
// ---------------------------------------------------------------------------

/**
 * Single config entry in GET /jobmanager/config response.
 */
export interface FlinkJobManagerConfigEntry {
  key: string;
  value: string;
}

/**
 * GET /jobmanager/config — returns an array of {key, value} pairs
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobmanager-config
 */
export type FlinkJobManagerConfigResponse = FlinkJobManagerConfigEntry[];

/**
 * JVM info within GET /jobmanager/environment.
 */
export interface FlinkJvmInfo {
  version: string;
  arch: string;
  options: string[];
}

/**
 * GET /jobmanager/environment — returns JVM info, classpath, system properties
 */
export interface FlinkJobManagerEnvironmentResponse {
  jvm: FlinkJvmInfo;
  classpath: string[];
  "system-properties": Record<string, string>;
}

/**
 * Aggregate envelope for Job Manager detail.
 * Combines config + environment + metrics in a single response.
 */
export interface FlinkJobManagerDetailAggregate {
  config: FlinkJobManagerConfigResponse;
  environment: FlinkJobManagerEnvironmentResponse;
  metrics: FlinkMetricItem[];
}

// ---------------------------------------------------------------------------
// Cluster config — GET /config (feature flags)
// ---------------------------------------------------------------------------

/**
 * GET /config — Returns cluster-level configuration including feature flags.
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#config
 */
export type FlinkClusterConfigResponse = FlinkJobManagerConfigEntry[];

// ---------------------------------------------------------------------------
// Vertex metrics — GET /jobs/:jid/vertices/:vid/metrics
// ---------------------------------------------------------------------------

/**
 * GET /jobs/:jid/vertices/:vid/metrics?get=...
 * Returns an array of FlinkMetricItem (reuses the same shape as TM/JM metrics).
 */
export type FlinkVertexMetricsResponse = FlinkMetricItem[];

// ---------------------------------------------------------------------------
// Checkpoint detail — GET /jobs/:jid/checkpoints/:cpid/details
// ---------------------------------------------------------------------------

/**
 * Per-subtask checkpoint stats within the checkpoint detail response.
 */
export interface FlinkCheckpointSubtaskStats {
  index: number;
  status: string;
  ack_timestamp: number;
  end_to_end_duration: number;
  state_size: number;
  checkpoint_duration: {
    sync: number;
    async: number;
  };
  alignment: {
    buffered: number;
    duration: number;
  };
  start_delay: number;
}

/**
 * Per-vertex checkpoint summary within the checkpoint detail response.
 */
export interface FlinkCheckpointTaskStats {
  id: string;
  status: string;
  latest_ack_timestamp: number;
  state_size: number;
  end_to_end_duration: number;
  num_subtasks: number;
  num_acknowledged_subtasks: number;
}

/**
 * GET /jobs/:jid/checkpoints/:cpid/details
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jobs-jobid-checkpoints-details-checkpointid
 */
export interface FlinkCheckpointDetailResponse {
  id: number;
  status: string;
  is_savepoint: boolean;
  trigger_timestamp: number;
  latest_ack_timestamp: number;
  state_size: number;
  end_to_end_duration: number;
  num_subtasks: number;
  num_acknowledged_subtasks: number;
  tasks: Record<string, FlinkCheckpointTaskStats>;
}

// ---------------------------------------------------------------------------
// Subtask times — GET /jobs/:jid/vertices/:vid/subtasktimes
// ---------------------------------------------------------------------------

/**
 * Single subtask timing entry.
 */
export interface FlinkSubtaskTimeEntry {
  subtask: number;
  host: string;
  duration: number;
  timestamps: Record<string, number>;
}

/**
 * GET /jobs/:jid/vertices/:vid/subtasktimes
 */
export interface FlinkSubtaskTimesResponse {
  id: string;
  name: string;
  now: number;
  subtasks: FlinkSubtaskTimeEntry[];
}

// ---------------------------------------------------------------------------
// Flamegraph — GET /jobs/:jid/vertices/:vid/flamegraph
// ---------------------------------------------------------------------------

/**
 * Flamegraph node entry — recursive tree structure.
 */
export interface FlinkFlamegraphNode {
  name: string;
  value: number;
  children?: FlinkFlamegraphNode[];
}

/**
 * GET /jobs/:jid/vertices/:vid/flamegraph?type=...
 */
export interface FlinkFlamegraphResponse {
  "end-timestamp": number;
  data: FlinkFlamegraphNode;
}

// ---------------------------------------------------------------------------
// JAR management — GET/POST /jars, DELETE /jars/:jarid, POST /jars/:jarid/run
// ---------------------------------------------------------------------------

/**
 * Single JAR entry in the jars list response.
 */
export interface FlinkJarEntry {
  id: string;
  name: string;
  uploaded: number;
  entry: Array<{
    name: string;
    description: string | null;
  }>;
}

/**
 * GET /jars — list uploaded JARs
 * @see https://nightlies.apache.org/flink/flink-docs-stable/docs/ops/rest_api/#jars
 */
export interface FlinkJarsResponse {
  address: string;
  files: FlinkJarEntry[];
}

/**
 * POST /jars/upload — response after uploading a JAR
 */
export interface FlinkJarUploadResponse {
  filename: string;
  status: string;
}

/**
 * POST /jars/:jarid/run — response after running a JAR
 */
export interface FlinkJarRunResponse {
  jobid: string;
}
