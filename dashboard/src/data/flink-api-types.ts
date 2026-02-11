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
