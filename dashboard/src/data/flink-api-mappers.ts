// ---------------------------------------------------------------------------
// Mappers: Flink REST API response types → dashboard domain types
// Pure functions — no side effects, no API calls.
// ---------------------------------------------------------------------------

import type {
  FlinkOverviewResponse,
  FlinkJobsOverviewResponse,
  FlinkJobOverviewEntry,
  FlinkTaskCounts,
  FlinkJobDetailAggregate,
  FlinkJobDetailResponse,
  FlinkPlanNode,
  FlinkVertexInfo,
  FlinkJobExceptionsResponse,
  FlinkCheckpointingStatistics,
  FlinkCheckpointConfigResponse,
  FlinkJobConfigResponse,
  FlinkVertexDetailResponse,
  FlinkWatermarksResponse,
  FlinkVertexBackPressureResponse,
  FlinkVertexAccumulatorsResponse,
} from "./flink-api-types";
import type {
  Checkpoint,
  CheckpointConfig,
  CheckpointStatus,
  ClusterOverview,
  FlinkJob,
  JobConfiguration,
  JobEdge,
  JobException,
  JobPlan,
  JobStatus,
  JobVertex,
  JobVertexMetrics,
  JobVertexStatus,
  ShipStrategy,
  SubtaskMetrics,
  SubtaskBackPressure,
  TaskCounts,
  UserAccumulator,
  VertexBackPressure,
  VertexWatermark,
} from "./cluster-types";

// ---------------------------------------------------------------------------
// Job state mapping
// ---------------------------------------------------------------------------

const KNOWN_JOB_STATES = new Set<string>([
  "CREATED",
  "RUNNING",
  "FAILING",
  "FAILED",
  "CANCELLING",
  "CANCELED",
  "FINISHED",
  "RESTARTING",
  "SUSPENDED",
  "RECONCILING",
]);

export function mapJobState(apiState: string): JobStatus {
  if (KNOWN_JOB_STATES.has(apiState)) return apiState as JobStatus;
  return "CREATED";
}

// ---------------------------------------------------------------------------
// Task counts: 10 API states → 5 dashboard states
// ---------------------------------------------------------------------------

export function mapTaskCounts(api: FlinkTaskCounts): TaskCounts {
  return {
    pending:
      api.created +
      api.scheduled +
      api.deploying +
      api.reconciling +
      api.initializing,
    running: api.running,
    finished: api.finished,
    canceling: api.canceling + api.canceled,
    failed: api.failed,
  };
}

// ---------------------------------------------------------------------------
// Overview mapping
// ---------------------------------------------------------------------------

export function mapOverviewResponse(api: FlinkOverviewResponse): ClusterOverview {
  return {
    flinkVersion: api["flink-version"],
    flinkCommitId: api["flink-commit"],
    totalTaskSlots: api["slots-total"],
    availableTaskSlots: api["slots-available"],
    runningJobs: api["jobs-running"],
    finishedJobs: api["jobs-finished"],
    cancelledJobs: api["jobs-cancelled"],
    failedJobs: api["jobs-failed"],
    taskManagerCount: api.taskmanagers,
  };
}

// ---------------------------------------------------------------------------
// Jobs overview mapping
// ---------------------------------------------------------------------------

const RUNNING_STATES = new Set<string>(["RUNNING", "CREATED", "RESTARTING", "RECONCILING"]);

function mapJobEntry(entry: FlinkJobOverviewEntry): FlinkJob {
  return {
    id: entry.jid,
    name: entry.name,
    status: mapJobState(entry.state),
    startTime: new Date(entry["start-time"]),
    endTime: entry["end-time"] === -1 ? null : new Date(entry["end-time"]),
    duration: entry.duration,
    tasks: mapTaskCounts(entry.tasks),
    parallelism: Object.values(entry.tasks).reduce((sum, n) => sum + n, 0),
    plan: null,
    exceptions: [],
    checkpoints: [],
    checkpointConfig: null,
    subtaskMetrics: {},
    configuration: [],
    watermarks: {},
    backpressure: {},
    accumulators: {},
  };
}

export function mapJobsOverviewResponse(api: FlinkJobsOverviewResponse): {
  runningJobs: FlinkJob[];
  completedJobs: FlinkJob[];
} {
  const runningJobs: FlinkJob[] = [];
  const completedJobs: FlinkJob[] = [];

  for (const entry of api.jobs) {
    const job = mapJobEntry(entry);
    if (RUNNING_STATES.has(entry.state)) {
      runningJobs.push(job);
    } else {
      completedJobs.push(job);
    }
  }

  return { runningJobs, completedJobs };
}

// ---------------------------------------------------------------------------
// Job detail mapping — GET /jobs/:jobid aggregate response
// ---------------------------------------------------------------------------

/**
 * Map Flink ExecutionState (10 values) → dashboard JobVertexStatus (5 values).
 * SCHEDULED, DEPLOYING, RECONCILING, INITIALIZING → CREATED
 * CANCELING → CANCELED
 */
export function mapVertexStatus(apiState: string): JobVertexStatus {
  switch (apiState) {
    case "RUNNING":
      return "RUNNING";
    case "FINISHED":
      return "FINISHED";
    case "FAILED":
      return "FAILED";
    case "CANCELED":
      return "CANCELED";
    case "CANCELING":
      return "CANCELED";
    case "CREATED":
    case "SCHEDULED":
    case "DEPLOYING":
    case "RECONCILING":
    case "INITIALIZING":
      return "CREATED";
    default:
      return "CREATED";
  }
}

/**
 * Map uppercase task counts Record (from vertex API) → collapsed 5-state TaskCounts.
 * API uses uppercase keys: CREATED, SCHEDULED, DEPLOYING, RUNNING, etc.
 */
export function mapUppercaseTaskCounts(api: Record<string, number>): TaskCounts {
  return {
    pending:
      (api["CREATED"] ?? 0) +
      (api["SCHEDULED"] ?? 0) +
      (api["DEPLOYING"] ?? 0) +
      (api["RECONCILING"] ?? 0) +
      (api["INITIALIZING"] ?? 0),
    running: api["RUNNING"] ?? 0,
    finished: api["FINISHED"] ?? 0,
    canceling: (api["CANCELING"] ?? 0) + (api["CANCELED"] ?? 0),
    failed: api["FAILED"] ?? 0,
  };
}

/**
 * Map raw ship_strategy string → ShipStrategy enum.
 * Known values pass through; unknown defaults to FORWARD.
 */
const KNOWN_SHIP_STRATEGIES = new Set<string>([
  "FORWARD",
  "HASH",
  "REBALANCE",
  "BROADCAST",
  "RESCALE",
  "GLOBAL",
]);

export function mapShipStrategy(raw: string): ShipStrategy {
  const upper = raw.toUpperCase();
  if (KNOWN_SHIP_STRATEGIES.has(upper)) return upper as ShipStrategy;
  return "FORWARD";
}

/**
 * Map API vertex metrics to domain vertex metrics, converting accumulated
 * totals to per-second rates using job duration.
 */
function mapVertexMetrics(
  v: FlinkVertexInfo,
  jobDurationMs: number,
): JobVertexMetrics {
  const durationSec = Math.max(1, jobDurationMs / 1000);
  const m = v.metrics;
  return {
    recordsIn: m["read-records"],
    recordsOut: m["write-records"],
    bytesIn: m["read-bytes"],
    bytesOut: m["write-bytes"],
    busyTimeMsPerSecond: Math.round(m["accumulated-busy-time"] / durationSec),
    backPressuredTimeMsPerSecond: Math.round(
      m["accumulated-backpressured-time"] / durationSec,
    ),
  };
}

/**
 * Map API vertices array → domain JobVertex array.
 */
export function mapJobDetailVertices(
  apiVertices: FlinkVertexInfo[],
  jobDurationMs: number,
): JobVertex[] {
  return apiVertices.map((v) => ({
    id: v.id,
    name: v.name,
    parallelism: v.parallelism,
    status: mapVertexStatus(v.status),
    metrics: mapVertexMetrics(v, jobDurationMs),
    tasks: mapUppercaseTaskCounts(v.tasks),
    duration: v.duration,
    startTime: v["start-time"],
  }));
}

/**
 * Derive edges from plan nodes' input arrays.
 * Each input's id is the source vertex, the node's id is the target.
 */
export function mapJobPlanEdges(planNodes: FlinkPlanNode[]): JobEdge[] {
  const edges: JobEdge[] = [];
  for (const node of planNodes) {
    if (node.inputs) {
      for (const input of node.inputs) {
        edges.push({
          source: input.id,
          target: node.id,
          shipStrategy: mapShipStrategy(input.ship_strategy),
        });
      }
    }
  }
  return edges;
}

/**
 * Assemble a complete JobPlan from API vertices and plan data.
 */
export function mapJobPlan(
  apiVertices: FlinkVertexInfo[],
  apiPlan: FlinkJobDetailResponse["plan"],
  jobDurationMs: number,
): JobPlan {
  return {
    vertices: mapJobDetailVertices(apiVertices, jobDurationMs),
    edges: mapJobPlanEdges(apiPlan.nodes),
  };
}

/**
 * Extract exception message from stacktrace first line.
 * Format: "com.example.Exception: The actual message"
 * Returns the part after the colon, or the full first line if no colon found.
 */
function extractExceptionMessage(stacktrace: string): string {
  const firstLine = stacktrace.split("\n")[0] ?? "";
  const colonIdx = firstLine.indexOf(": ");
  if (colonIdx !== -1) {
    return firstLine.substring(colonIdx + 2).trim();
  }
  return firstLine.trim();
}

/**
 * Map API exceptions → domain JobException array.
 */
export function mapExceptions(
  api: FlinkJobExceptionsResponse,
): JobException[] {
  return api.exceptionHistory.entries.map((e) => ({
    timestamp: new Date(e.timestamp),
    name: e.exceptionName,
    message: extractExceptionMessage(e.stacktrace),
    stacktrace: e.stacktrace,
    taskName: e.taskName || null,
    location: e.endpoint || null,
  }));
}

/**
 * Map checkpoint status string → domain CheckpointStatus.
 */
function mapCheckpointStatus(status: string): CheckpointStatus {
  if (status === "COMPLETED") return "COMPLETED";
  if (status === "FAILED") return "FAILED";
  return "IN_PROGRESS";
}

/**
 * Map API checkpoints → domain Checkpoint array.
 */
export function mapCheckpoints(
  api: FlinkCheckpointingStatistics,
): Checkpoint[] {
  return api.history.map((c) => ({
    id: c.id,
    status: mapCheckpointStatus(c.status),
    triggerTimestamp: new Date(c.trigger_timestamp),
    duration: c.end_to_end_duration,
    size: c.state_size,
    processedData: c.processed_data,
    isSavepoint: c.is_savepoint,
  }));
}

/**
 * Map API checkpoint config → domain CheckpointConfig.
 */
export function mapCheckpointConfig(
  api: FlinkCheckpointConfigResponse,
): CheckpointConfig {
  return {
    mode: api.mode === "AT_LEAST_ONCE" ? "AT_LEAST_ONCE" : "EXACTLY_ONCE",
    interval: api.interval,
    timeout: api.timeout,
    minPause: api.min_pause,
    maxConcurrent: api.max_concurrent,
  };
}

/**
 * Map API job config → domain JobConfiguration array.
 * Extracts user-config Record<string,string> into {key, value} pairs.
 */
export function mapJobConfiguration(
  api: FlinkJobConfigResponse,
): JobConfiguration[] {
  const userConfig = api["execution-config"]["user-config"];
  return Object.entries(userConfig).map(([key, value]) => ({ key, value }));
}

/**
 * Map per-vertex detail responses → domain Record<vertexId, SubtaskMetrics[]>.
 */
export function mapSubtaskMetrics(
  vertexDetails: Record<string, FlinkVertexDetailResponse>,
): Record<string, SubtaskMetrics[]> {
  const result: Record<string, SubtaskMetrics[]> = {};

  for (const [vertexId, detail] of Object.entries(vertexDetails)) {
    result[vertexId] = detail.subtasks.map((s) => {
      const durationSec = Math.max(1, s.duration / 1000);
      return {
        subtaskIndex: s.subtask,
        status: s.status,
        attempt: s.attempt,
        endpoint: s.endpoint,
        taskManagerId: s["taskmanager-id"],
        startTime: s["start-time"],
        endTime: s["end-time"],
        duration: s.duration,
        recordsIn: s.metrics["read-records"],
        recordsOut: s.metrics["write-records"],
        bytesIn: s.metrics["read-bytes"],
        bytesOut: s.metrics["write-bytes"],
        busyTimeMsPerSecond: Math.round(
          s.metrics["accumulated-busy-time"] / durationSec,
        ),
        backPressuredTimeMsPerSecond: Math.round(
          s.metrics["accumulated-backpressured-time"] / durationSec,
        ),
        idleTimeMsPerSecond: Math.round(
          s.metrics["accumulated-idle-time"] / durationSec,
        ),
      };
    });
  }

  return result;
}

/**
 * Map watermark responses → domain Record<vertexId, VertexWatermark[]>.
 * Watermark metric IDs follow the pattern: "N.currentInputWatermark" where N is the subtask index.
 */
export function mapWatermarks(
  watermarks: Record<string, FlinkWatermarksResponse>,
): Record<string, VertexWatermark[]> {
  const result: Record<string, VertexWatermark[]> = {};

  for (const [vertexId, metrics] of Object.entries(watermarks)) {
    const arr = Array.isArray(metrics) ? metrics : [];
    result[vertexId] = arr
      .filter((m) => m.id.endsWith(".currentInputWatermark"))
      .map((m) => {
        const subtaskIndex = parseInt(m.id.split(".")[0], 10);
        const value = parseFloat(m.value);
        return {
          subtaskIndex: isNaN(subtaskIndex) ? 0 : subtaskIndex,
          watermark: isNaN(value) ? -Infinity : value,
        };
      })
      .sort((a, b) => a.subtaskIndex - b.subtaskIndex);
  }

  return result;
}

/**
 * Map backpressure responses → domain Record<vertexId, VertexBackPressure>.
 */
export function mapBackPressure(
  backpressure: Record<string, FlinkVertexBackPressureResponse>,
): Record<string, VertexBackPressure> {
  const result: Record<string, VertexBackPressure> = {};

  for (const [vertexId, response] of Object.entries(backpressure)) {
    result[vertexId] = {
      level: response.backpressureLevel,
      endTimestamp: response["end-timestamp"],
      subtasks: (response.subtasks ?? []).map(
        (s): SubtaskBackPressure => ({
          subtaskIndex: s.subtask,
          level: s.backpressureLevel,
          ratio: s.ratio,
          busyRatio: s.busyRatio,
          idleRatio: s.idleRatio,
        }),
      ),
    };
  }

  return result;
}

/**
 * Map accumulators responses → domain Record<vertexId, UserAccumulator[]>.
 */
export function mapAccumulators(
  accumulators: Record<string, FlinkVertexAccumulatorsResponse>,
): Record<string, UserAccumulator[]> {
  const result: Record<string, UserAccumulator[]> = {};

  for (const [vertexId, response] of Object.entries(accumulators)) {
    result[vertexId] = (response["user-accumulators"] ?? []).map(
      (a): UserAccumulator => ({
        name: a.name,
        type: a.type,
        value: a.value,
      }),
    );
  }

  return result;
}

/**
 * Top-level orchestrator: map the entire aggregate response → FlinkJob.
 */
export function mapJobDetailAggregate(api: FlinkJobDetailAggregate): FlinkJob {
  const job = api.job;
  const plan = mapJobPlan(job.vertices, job.plan, job.duration);
  const exceptions = mapExceptions(api.exceptions);
  const checkpoints = mapCheckpoints(api.checkpoints);
  const checkpointConfig = mapCheckpointConfig(api.checkpointConfig);
  const configuration = mapJobConfiguration(api.jobConfig);
  const subtaskMetrics = mapSubtaskMetrics(api.vertexDetails);
  const watermarks = mapWatermarks(api.watermarks ?? {});
  const backpressure = mapBackPressure(api.backpressure ?? {});
  const accumulators = mapAccumulators(api.accumulators ?? {});

  return {
    id: job.jid,
    name: job.name,
    status: mapJobState(job.state),
    startTime: new Date(job["start-time"]),
    endTime: job["end-time"] === -1 ? null : new Date(job["end-time"]),
    duration: job.duration,
    tasks: mapUppercaseTaskCounts(job["status-counts"]),
    parallelism: Math.max(
      ...job.vertices.map((v) => v.parallelism),
      1,
    ),
    plan,
    exceptions,
    checkpoints,
    checkpointConfig,
    subtaskMetrics,
    configuration,
    watermarks,
    backpressure,
    accumulators,
  };
}
