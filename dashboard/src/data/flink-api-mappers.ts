// ---------------------------------------------------------------------------
// Mappers: Flink REST API response types → dashboard domain types
// Pure functions — no side effects, no API calls.
// ---------------------------------------------------------------------------

import type {
  Checkpoint,
  CheckpointConfig,
  CheckpointCounts,
  CheckpointDetail,
  CheckpointStatus,
  CheckpointTaskDetail,
  ClasspathEntry,
  ClusterOverview,
  FlamegraphData,
  FlamegraphNode,
  FlinkFeatureFlags,
  FlinkJob,
  JobConfiguration,
  JobEdge,
  JobException,
  JobManagerConfig,
  JobManagerInfo,
  JobManagerMetrics,
  JobPlan,
  JobStatus,
  JobVertex,
  JobVertexMetrics,
  JobVertexStatus,
  JvmInfo,
  JvmMemoryConfig,
  LogFileEntry,
  ShipStrategy,
  SubtaskBackPressure,
  SubtaskMetrics,
  SubtaskTimeline,
  TaskCounts,
  TaskManager,
  TaskManagerMetrics,
  ThreadDumpInfo,
  UploadedJar,
  UserAccumulator,
  VertexBackPressure,
  VertexWatermark,
} from "./cluster-types"
import type {
  FlinkCheckpointConfigResponse,
  FlinkCheckpointDetailResponse,
  FlinkCheckpointingStatistics,
  FlinkClusterConfigResponse,
  FlinkFlamegraphNode,
  FlinkFlamegraphResponse,
  FlinkJarsResponse,
  FlinkJobConfigResponse,
  FlinkJobDetailAggregate,
  FlinkJobDetailResponse,
  FlinkJobExceptionsResponse,
  FlinkJobManagerDetailAggregate,
  FlinkJobOverviewEntry,
  FlinkJobsOverviewResponse,
  FlinkLogListResponse,
  FlinkMetricItem,
  FlinkOverviewResponse,
  FlinkPlanNode,
  FlinkSubtaskTimesResponse,
  FlinkTaskCounts,
  FlinkTaskManagerDetailAggregate,
  FlinkTaskManagersResponse,
  FlinkThreadDumpResponse,
  FlinkVertexAccumulatorsResponse,
  FlinkVertexBackPressureResponse,
  FlinkVertexDetailResponse,
  FlinkVertexInfo,
  FlinkWatermarksResponse,
} from "./flink-api-types"

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
])

export function mapJobState(apiState: string): JobStatus {
  if (KNOWN_JOB_STATES.has(apiState)) return apiState as JobStatus
  return "CREATED"
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
  }
}

// ---------------------------------------------------------------------------
// Overview mapping
// ---------------------------------------------------------------------------

export function mapOverviewResponse(
  api: FlinkOverviewResponse,
): ClusterOverview {
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
  }
}

// ---------------------------------------------------------------------------
// Jobs overview mapping
// ---------------------------------------------------------------------------

const RUNNING_STATES = new Set<string>([
  "RUNNING",
  "CREATED",
  "RESTARTING",
  "RECONCILING",
])

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
    checkpointCounts: null,
    checkpointConfig: null,
    subtaskMetrics: {},
    configuration: [],
    watermarks: {},
    backpressure: {},
    accumulators: {},
  }
}

export function mapJobsOverviewResponse(api: FlinkJobsOverviewResponse): {
  runningJobs: FlinkJob[]
  completedJobs: FlinkJob[]
} {
  const runningJobs: FlinkJob[] = []
  const completedJobs: FlinkJob[] = []

  for (const entry of api.jobs ?? []) {
    const job = mapJobEntry(entry)
    if (RUNNING_STATES.has(entry.state)) {
      runningJobs.push(job)
    } else {
      completedJobs.push(job)
    }
  }

  return { runningJobs, completedJobs }
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
      return "RUNNING"
    case "FINISHED":
      return "FINISHED"
    case "FAILED":
      return "FAILED"
    case "CANCELED":
      return "CANCELED"
    case "CANCELING":
      return "CANCELED"
    case "CREATED":
    case "SCHEDULED":
    case "DEPLOYING":
    case "RECONCILING":
    case "INITIALIZING":
      return "CREATED"
    default:
      return "CREATED"
  }
}

/**
 * Map uppercase task counts Record (from vertex API) → collapsed 5-state TaskCounts.
 * API uses uppercase keys: CREATED, SCHEDULED, DEPLOYING, RUNNING, etc.
 */
export function mapUppercaseTaskCounts(
  api: Record<string, number>,
): TaskCounts {
  return {
    pending:
      (api.CREATED ?? 0) +
      (api.SCHEDULED ?? 0) +
      (api.DEPLOYING ?? 0) +
      (api.RECONCILING ?? 0) +
      (api.INITIALIZING ?? 0),
    running: api.RUNNING ?? 0,
    finished: api.FINISHED ?? 0,
    canceling: (api.CANCELING ?? 0) + (api.CANCELED ?? 0),
    failed: api.FAILED ?? 0,
  }
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
])

export function mapShipStrategy(raw: string): ShipStrategy {
  const upper = raw.toUpperCase()
  if (KNOWN_SHIP_STRATEGIES.has(upper)) return upper as ShipStrategy
  return "FORWARD"
}

/**
 * Map API vertex metrics to domain vertex metrics, converting accumulated
 * totals to per-second rates using job duration.
 */
function mapVertexMetrics(
  v: FlinkVertexInfo,
  jobDurationMs: number,
): JobVertexMetrics {
  const durationSec = Math.max(1, jobDurationMs / 1000)
  const m = v.metrics
  return {
    recordsIn: m["read-records"],
    recordsOut: m["write-records"],
    bytesIn: m["read-bytes"],
    bytesOut: m["write-bytes"],
    busyTimeMsPerSecond: Math.round(m["accumulated-busy-time"] / durationSec),
    backPressuredTimeMsPerSecond: Math.round(
      m["accumulated-backpressured-time"] / durationSec,
    ),
  }
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
  }))
}

/**
 * Derive edges from plan nodes' input arrays.
 * Each input's id is the source vertex, the node's id is the target.
 */
export function mapJobPlanEdges(planNodes: FlinkPlanNode[]): JobEdge[] {
  const edges: JobEdge[] = []
  for (const node of planNodes) {
    if (node.inputs) {
      for (const input of node.inputs) {
        edges.push({
          source: input.id,
          target: node.id,
          shipStrategy: mapShipStrategy(input.ship_strategy),
        })
      }
    }
  }
  return edges
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
    edges: mapJobPlanEdges(apiPlan?.nodes ?? []),
  }
}

/**
 * Extract exception message from stacktrace first line.
 * Format: "com.example.Exception: The actual message"
 * Returns the part after the colon, or the full first line if no colon found.
 */
function extractExceptionMessage(stacktrace: string): string {
  const firstLine = stacktrace.split("\n")[0] ?? ""
  const colonIdx = firstLine.indexOf(": ")
  if (colonIdx !== -1) {
    return firstLine.substring(colonIdx + 2).trim()
  }
  return firstLine.trim()
}

/**
 * Map API exceptions → domain JobException array.
 */
export function mapExceptions(api: FlinkJobExceptionsResponse): JobException[] {
  return (api.exceptionHistory?.entries ?? []).map((e) => ({
    timestamp: new Date(e.timestamp),
    name: e.exceptionName,
    message: extractExceptionMessage(e.stacktrace),
    stacktrace: e.stacktrace,
    taskName: e.taskName || null,
    location: e.endpoint || null,
  }))
}

/**
 * Map checkpoint status string → domain CheckpointStatus.
 */
function mapCheckpointStatus(status: string): CheckpointStatus {
  if (status === "COMPLETED") return "COMPLETED"
  if (status === "FAILED") return "FAILED"
  return "IN_PROGRESS"
}

/**
 * Map API checkpoints → domain Checkpoint array.
 */
export function mapCheckpoints(
  api: FlinkCheckpointingStatistics,
): Checkpoint[] {
  return (api.history ?? []).map((c) => ({
    id: c.id,
    status: mapCheckpointStatus(c.status),
    triggerTimestamp: new Date(c.trigger_timestamp),
    duration: c.end_to_end_duration,
    size: c.state_size,
    processedData: c.processed_data,
    isSavepoint: c.is_savepoint,
  }))
}

/**
 * Map API checkpoint counts → domain CheckpointCounts.
 * These are the lifetime totals reported by Flink, not limited by retention.
 */
export function mapCheckpointCounts(
  api: FlinkCheckpointingStatistics,
): CheckpointCounts {
  const counts = api.counts ?? {}
  return {
    completed: (counts.completed as number) ?? 0,
    failed: (counts.failed as number) ?? 0,
    inProgress: (counts.in_progress as number) ?? 0,
    total: (counts.total as number) ?? 0,
  }
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
  }
}

/**
 * Map API job config → domain JobConfiguration array.
 * Extracts user-config Record<string,string> into {key, value} pairs.
 */
export function mapJobConfiguration(
  api: FlinkJobConfigResponse,
): JobConfiguration[] {
  const userConfig = api["execution-config"]?.["user-config"] ?? {}
  return Object.entries(userConfig).map(([key, value]) => ({ key, value }))
}

/**
 * Map per-vertex detail responses → domain Record<vertexId, SubtaskMetrics[]>.
 */
export function mapSubtaskMetrics(
  vertexDetails: Record<string, FlinkVertexDetailResponse>,
): Record<string, SubtaskMetrics[]> {
  const result: Record<string, SubtaskMetrics[]> = {}

  for (const [vertexId, detail] of Object.entries(vertexDetails)) {
    result[vertexId] = (detail.subtasks ?? []).map((s) => {
      const durationSec = Math.max(1, s.duration / 1000)
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
      }
    })
  }

  return result
}

/**
 * Map watermark responses → domain Record<vertexId, VertexWatermark[]>.
 * Watermark metric IDs follow the pattern: "N.currentInputWatermark" where N is the subtask index.
 */
export function mapWatermarks(
  watermarks: Record<string, FlinkWatermarksResponse>,
): Record<string, VertexWatermark[]> {
  const result: Record<string, VertexWatermark[]> = {}

  for (const [vertexId, metrics] of Object.entries(watermarks)) {
    const arr = Array.isArray(metrics) ? metrics : []
    result[vertexId] = arr
      .filter((m) => m.id.endsWith(".currentInputWatermark"))
      .map((m) => {
        const subtaskIndex = parseInt(m.id.split(".")[0], 10)
        const value = parseFloat(m.value)
        return {
          subtaskIndex: Number.isNaN(subtaskIndex) ? 0 : subtaskIndex,
          watermark: Number.isNaN(value) ? -Infinity : value,
        }
      })
      .sort((a, b) => a.subtaskIndex - b.subtaskIndex)
  }

  return result
}

/**
 * Map backpressure responses → domain Record<vertexId, VertexBackPressure>.
 */
export function mapBackPressure(
  backpressure: Record<string, FlinkVertexBackPressureResponse>,
): Record<string, VertexBackPressure> {
  const result: Record<string, VertexBackPressure> = {}

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
    }
  }

  return result
}

/**
 * Map accumulators responses → domain Record<vertexId, UserAccumulator[]>.
 */
export function mapAccumulators(
  accumulators: Record<string, FlinkVertexAccumulatorsResponse>,
): Record<string, UserAccumulator[]> {
  const result: Record<string, UserAccumulator[]> = {}

  for (const [vertexId, response] of Object.entries(accumulators)) {
    result[vertexId] = (response["user-accumulators"] ?? []).map(
      (a): UserAccumulator => ({
        name: a.name,
        type: a.type,
        value: a.value,
      }),
    )
  }

  return result
}

/**
 * Top-level orchestrator: map the entire aggregate response → FlinkJob.
 */
export function mapJobDetailAggregate(api: FlinkJobDetailAggregate): FlinkJob {
  const job = api.job
  const plan = mapJobPlan(job.vertices ?? [], job.plan, job.duration)
  const exceptions = mapExceptions(api.exceptions)
  const checkpoints = mapCheckpoints(api.checkpoints)
  const checkpointCounts = mapCheckpointCounts(api.checkpoints)
  const checkpointConfig = mapCheckpointConfig(api.checkpointConfig)
  const configuration = mapJobConfiguration(api.jobConfig)
  const subtaskMetrics = mapSubtaskMetrics(api.vertexDetails)
  const watermarks = mapWatermarks(api.watermarks ?? {})
  const backpressure = mapBackPressure(api.backpressure ?? {})
  const accumulators = mapAccumulators(api.accumulators ?? {})

  return {
    id: job.jid,
    name: job.name,
    status: mapJobState(job.state),
    startTime: new Date(job["start-time"]),
    endTime: job["end-time"] === -1 ? null : new Date(job["end-time"]),
    duration: job.duration,
    tasks: mapUppercaseTaskCounts(job["status-counts"]),
    parallelism: Math.max(...(job.vertices ?? []).map((v) => v.parallelism), 1),
    plan,
    exceptions,
    checkpoints,
    checkpointCounts,
    checkpointConfig,
    subtaskMetrics,
    configuration,
    watermarks,
    backpressure,
    accumulators,
  }
}

// ---------------------------------------------------------------------------
// Task Manager mapping
// ---------------------------------------------------------------------------

/**
 * Extract a numeric metric value from a FlinkMetricItem array by ID.
 */
function metricValue(metrics: FlinkMetricItem[], id: string): number {
  const item = metrics.find((m) => m.id === id)
  if (!item) return 0
  const v = parseFloat(item.value)
  return Number.isNaN(v) ? 0 : v
}

/**
 * Map a FlinkMetricItem[] to TaskManagerMetrics.
 * Flink metric IDs follow the pattern: Status.JVM.Memory.Heap.Used, etc.
 */
export function mapTaskManagerMetrics(
  metrics: FlinkMetricItem[],
): TaskManagerMetrics {
  return {
    cpuUsage: metricValue(metrics, "Status.JVM.CPU.Load") * 100,
    heapUsed: metricValue(metrics, "Status.JVM.Memory.Heap.Used"),
    heapCommitted: metricValue(metrics, "Status.JVM.Memory.Heap.Committed"),
    heapMax: metricValue(metrics, "Status.JVM.Memory.Heap.Max"),
    nonHeapUsed: metricValue(metrics, "Status.JVM.Memory.NonHeap.Used"),
    nonHeapCommitted: metricValue(
      metrics,
      "Status.JVM.Memory.NonHeap.Committed",
    ),
    nonHeapMax: metricValue(metrics, "Status.JVM.Memory.NonHeap.Max"),
    directCount: metricValue(metrics, "Status.JVM.Memory.Direct.Count"),
    directUsed: metricValue(metrics, "Status.JVM.Memory.Direct.MemoryUsed"),
    directMax: metricValue(metrics, "Status.JVM.Memory.Direct.TotalCapacity"),
    mappedCount: metricValue(metrics, "Status.JVM.Memory.Mapped.Count"),
    mappedUsed: metricValue(metrics, "Status.JVM.Memory.Mapped.MemoryUsed"),
    mappedMax: metricValue(metrics, "Status.JVM.Memory.Mapped.TotalCapacity"),
    nettyShuffleMemoryAvailable: metricValue(
      metrics,
      "Status.Shuffle.Netty.AvailableMemory",
    ),
    nettyShuffleMemoryUsed: metricValue(
      metrics,
      "Status.Shuffle.Netty.UsedMemory",
    ),
    nettyShuffleMemoryTotal: metricValue(
      metrics,
      "Status.Shuffle.Netty.TotalMemory",
    ),
    nettyShuffleSegmentsAvailable: metricValue(
      metrics,
      "Status.Shuffle.Netty.AvailableMemorySegments",
    ),
    nettyShuffleSegmentsUsed: metricValue(
      metrics,
      "Status.Shuffle.Netty.UsedMemorySegments",
    ),
    nettyShuffleSegmentsTotal: metricValue(
      metrics,
      "Status.Shuffle.Netty.TotalMemorySegments",
    ),
    managedMemoryUsed: metricValue(metrics, "Status.Flink.Memory.Managed.Used"),
    managedMemoryTotal: metricValue(
      metrics,
      "Status.Flink.Memory.Managed.Total",
    ),
    metaspaceUsed: metricValue(metrics, "Status.JVM.Memory.Metaspace.Used"),
    metaspaceMax: metricValue(metrics, "Status.JVM.Memory.Metaspace.Max"),
    garbageCollectors: extractGarbageCollectors(metrics),
    threadCount: metricValue(metrics, "Status.JVM.Threads.Count"),
  }
}

/**
 * Extract garbage collector metrics from the flat metric list.
 * GC metrics follow pattern: Status.JVM.GarbageCollector.<Name>.Count / .Time
 */
function extractGarbageCollectors(
  metrics: FlinkMetricItem[],
): TaskManagerMetrics["garbageCollectors"] {
  const gcPrefix = "Status.JVM.GarbageCollector."
  const gcNames = new Set<string>()

  for (const m of metrics) {
    if (m.id.startsWith(gcPrefix)) {
      const rest = m.id.slice(gcPrefix.length)
      const dotIdx = rest.lastIndexOf(".")
      if (dotIdx > 0) {
        gcNames.add(rest.slice(0, dotIdx))
      }
    }
  }

  return Array.from(gcNames).map((name) => ({
    name,
    count: metricValue(metrics, `${gcPrefix}${name}.Count`),
    time: metricValue(metrics, `${gcPrefix}${name}.Time`),
  }))
}

/**
 * Map GET /taskmanagers response → TaskManager[] domain list.
 * Note: metrics and tab data (logs, stdout, etc.) are NOT available from the list endpoint.
 * They are populated by the detail/metrics endpoints.
 */
export function mapTaskManagers(api: FlinkTaskManagersResponse): TaskManager[] {
  return (api.taskmanagers ?? []).map((tm) => ({
    id: tm.id,
    path: tm.path,
    dataPort: tm.dataPort,
    jmxPort: tm.jmxPort,
    // Flink's "timeSinceLastHeartbeat" is actually an absolute epoch timestamp
    // (the Java field is named `lastHeartbeat`; the JSON key is a misnomer).
    lastHeartbeat: new Date(tm.timeSinceLastHeartbeat),
    slotsTotal: tm.slotsNumber,
    slotsFree: tm.freeSlots,
    cpuCores: tm.hardware.cpuCores,
    physicalMemory: tm.hardware.physicalMemory,
    freeMemory: tm.hardware.freeMemory,
    totalResource: {
      cpuCores: tm.totalResource.cpuCores,
      taskHeapMemory: tm.totalResource.taskHeapMemory,
      taskOffHeapMemory: tm.totalResource.taskOffHeapMemory,
      managedMemory: tm.totalResource.managedMemory,
      networkMemory: tm.totalResource.networkMemory,
    },
    freeResource: {
      cpuCores: tm.freeResource.cpuCores,
      taskHeapMemory: tm.freeResource.taskHeapMemory,
      taskOffHeapMemory: tm.freeResource.taskOffHeapMemory,
      managedMemory: tm.freeResource.managedMemory,
      networkMemory: tm.freeResource.networkMemory,
    },
    memoryConfiguration: {
      frameworkHeap: tm.memoryConfiguration.frameworkHeap,
      taskHeap: tm.memoryConfiguration.taskHeap,
      frameworkOffHeap: tm.memoryConfiguration.frameworkOffHeap,
      taskOffHeap: tm.memoryConfiguration.taskOffHeap,
      networkMemory: tm.memoryConfiguration.networkMemory,
      managedMemory: tm.memoryConfiguration.managedMemory,
      jvmMetaspace: tm.memoryConfiguration.jvmMetaspace,
      jvmOverhead: tm.memoryConfiguration.jvmOverhead,
      totalFlinkMemory: tm.memoryConfiguration.totalFlinkMemory,
      totalProcessMemory: tm.memoryConfiguration.totalProcessMemory,
    },
    allocatedSlots: (tm.allocatedSlots ?? []).map((s) => ({
      index: s.index,
      jobId: s.jobId,
      resource: {
        cpuCores: s.resource.cpuCores,
        taskHeapMemory: s.resource.taskHeapMemory,
        taskOffHeapMemory: s.resource.taskOffHeapMemory,
        managedMemory: s.resource.managedMemory,
        networkMemory: s.resource.networkMemory,
      },
    })),
    metrics: {
      cpuUsage: 0,
      heapUsed: 0,
      heapCommitted: 0,
      heapMax: 0,
      nonHeapUsed: 0,
      nonHeapCommitted: 0,
      nonHeapMax: 0,
      directCount: 0,
      directUsed: 0,
      directMax: 0,
      mappedCount: 0,
      mappedUsed: 0,
      mappedMax: 0,
      nettyShuffleMemoryAvailable: 0,
      nettyShuffleMemoryUsed: 0,
      nettyShuffleMemoryTotal: 0,
      nettyShuffleSegmentsAvailable: 0,
      nettyShuffleSegmentsUsed: 0,
      nettyShuffleSegmentsTotal: 0,
      managedMemoryUsed: 0,
      managedMemoryTotal: 0,
      metaspaceUsed: 0,
      metaspaceMax: 0,
      garbageCollectors: [],
      threadCount: 0,
    },
    logs: "",
    stdout: "",
    logFiles: [],
    threadDump: { threadInfos: [] },
  }))
}

/**
 * Map the TM detail aggregate → a fully-populated TaskManager.
 */
export function mapTaskManagerDetail(
  api: FlinkTaskManagerDetailAggregate,
): TaskManager {
  const tm = api.detail
  return {
    id: tm.id,
    path: tm.path,
    dataPort: tm.dataPort,
    jmxPort: tm.jmxPort,
    lastHeartbeat: new Date(tm.timeSinceLastHeartbeat),
    slotsTotal: tm.slotsNumber,
    slotsFree: tm.freeSlots,
    cpuCores: tm.hardware.cpuCores,
    physicalMemory: tm.hardware.physicalMemory,
    freeMemory: tm.hardware.freeMemory,
    totalResource: {
      cpuCores: tm.totalResource.cpuCores,
      taskHeapMemory: tm.totalResource.taskHeapMemory,
      taskOffHeapMemory: tm.totalResource.taskOffHeapMemory,
      managedMemory: tm.totalResource.managedMemory,
      networkMemory: tm.totalResource.networkMemory,
    },
    freeResource: {
      cpuCores: tm.freeResource.cpuCores,
      taskHeapMemory: tm.freeResource.taskHeapMemory,
      taskOffHeapMemory: tm.freeResource.taskOffHeapMemory,
      managedMemory: tm.freeResource.managedMemory,
      networkMemory: tm.freeResource.networkMemory,
    },
    memoryConfiguration: {
      frameworkHeap: tm.memoryConfiguration.frameworkHeap,
      taskHeap: tm.memoryConfiguration.taskHeap,
      frameworkOffHeap: tm.memoryConfiguration.frameworkOffHeap,
      taskOffHeap: tm.memoryConfiguration.taskOffHeap,
      networkMemory: tm.memoryConfiguration.networkMemory,
      managedMemory: tm.memoryConfiguration.managedMemory,
      jvmMetaspace: tm.memoryConfiguration.jvmMetaspace,
      jvmOverhead: tm.memoryConfiguration.jvmOverhead,
      totalFlinkMemory: tm.memoryConfiguration.totalFlinkMemory,
      totalProcessMemory: tm.memoryConfiguration.totalProcessMemory,
    },
    allocatedSlots: (tm.allocatedSlots ?? []).map((s) => ({
      index: s.index,
      jobId: s.jobId,
      resource: {
        cpuCores: s.resource.cpuCores,
        taskHeapMemory: s.resource.taskHeapMemory,
        taskOffHeapMemory: s.resource.taskOffHeapMemory,
        managedMemory: s.resource.managedMemory,
        networkMemory: s.resource.networkMemory,
      },
    })),
    metrics: mapTaskManagerMetrics(api.metrics),
    logs: "",
    stdout: "",
    logFiles: [],
    threadDump: { threadInfos: [] },
  }
}

// ---------------------------------------------------------------------------
// Job Manager mapping
// ---------------------------------------------------------------------------

/**
 * Map Job Manager metrics (FlinkMetricItem[]) → JobManagerMetrics snapshot.
 * Unlike TM metrics, JM metrics are used to populate a single-point snapshot
 * that the component accumulates into time-series arrays.
 */
export function mapJobManagerMetrics(metrics: FlinkMetricItem[]): {
  heapUsed: number
  heapMax: number
  nonHeapUsed: number
  nonHeapMax: number
  threadCount: number
  gcCount: number
  gcTime: number
} {
  return {
    heapUsed: metricValue(metrics, "Status.JVM.Memory.Heap.Used"),
    heapMax: metricValue(metrics, "Status.JVM.Memory.Heap.Max"),
    nonHeapUsed: metricValue(metrics, "Status.JVM.Memory.NonHeap.Used"),
    nonHeapMax: metricValue(metrics, "Status.JVM.Memory.NonHeap.Max"),
    threadCount: metricValue(metrics, "Status.JVM.Threads.Count"),
    gcCount: extractGcTotal(metrics, "Count"),
    gcTime: extractGcTotal(metrics, "Time"),
  }
}

function extractGcTotal(metrics: FlinkMetricItem[], suffix: string): number {
  const gcPrefix = "Status.JVM.GarbageCollector."
  let total = 0
  for (const m of metrics) {
    if (m.id.startsWith(gcPrefix) && m.id.endsWith(`.${suffix}`)) {
      const v = parseFloat(m.value)
      if (!Number.isNaN(v)) total += v
    }
  }
  return total
}

/**
 * Map JM config + environment aggregate → JobManagerInfo.
 * Note: logs, stdout, logFiles, threadDump are populated separately.
 */
export function mapJobManagerDetail(
  api: FlinkJobManagerDetailAggregate,
): JobManagerInfo {
  const config: JobManagerConfig[] = (api.config ?? []).map((c) => ({
    key: c.key,
    value: c.value,
  }))

  const jvmArgs = api.environment?.jvm?.options ?? []
  const systemProperties = Object.entries(
    api.environment?.["system-properties"] ?? {},
  ).map(([key, value]) => ({ key, value }))

  const metricsSnapshot = mapJobManagerMetrics(api.metrics)

  const jvmMemory: JvmMemoryConfig = {
    heapMax: metricsSnapshot.heapMax,
    heapUsed: metricsSnapshot.heapUsed,
    nonHeapMax: metricsSnapshot.nonHeapMax,
    nonHeapUsed: metricsSnapshot.nonHeapUsed,
    metaspaceMax: metricValue(api.metrics, "Status.JVM.Memory.Metaspace.Max"),
    metaspaceUsed: metricValue(api.metrics, "Status.JVM.Memory.Metaspace.Used"),
    directMax: metricValue(
      api.metrics,
      "Status.JVM.Memory.Direct.TotalCapacity",
    ),
    directUsed: metricValue(api.metrics, "Status.JVM.Memory.Direct.MemoryUsed"),
  }

  const jvm: JvmInfo = {
    arguments: jvmArgs,
    systemProperties,
    memoryConfig: jvmMemory,
  }

  const classpath: ClasspathEntry[] = (api.environment?.classpath ?? []).map(
    (p) => {
      const parts = p.split("/")
      const filename = parts[parts.length - 1] ?? p
      return {
        path: p,
        filename,
        size: 0,
        tag: classifyJarTag(filename),
      }
    },
  )

  const now = new Date()
  const metrics: JobManagerMetrics = {
    jvmHeapUsed: [{ timestamp: now, value: metricsSnapshot.heapUsed }],
    jvmHeapMax: metricsSnapshot.heapMax,
    jvmNonHeapUsed: [{ timestamp: now, value: metricsSnapshot.nonHeapUsed }],
    jvmNonHeapMax: metricsSnapshot.nonHeapMax,
    threadCount: [{ timestamp: now, value: metricsSnapshot.threadCount }],
    gcCount: [{ timestamp: now, value: metricsSnapshot.gcCount }],
    gcTime: [{ timestamp: now, value: metricsSnapshot.gcTime }],
  }

  return {
    config,
    metrics,
    logs: "",
    stdout: "",
    jvm,
    classpath,
    logFiles: [],
    threadDump: { threadInfos: [] },
  }
}

/**
 * Classify a JAR filename into a tag for the classpath table.
 */
function classifyJarTag(filename: string): string {
  const lower = filename.toLowerCase()
  if (lower.includes("flink-sql") || lower.includes("flink-table"))
    return "flink-sql"
  if (lower.includes("flink-connector") || lower.includes("connector"))
    return "connector"
  if (lower.includes("flink-core") || lower.includes("flink-dist"))
    return "flink-core"
  if (lower.includes("hadoop")) return "hadoop"
  if (
    lower.includes("log4j") ||
    lower.includes("slf4j") ||
    lower.includes("logging")
  )
    return "log4j"
  if (lower.includes("scala")) return "scala"
  if (lower.includes("kafka")) return "connector"
  if (lower.includes("jdbc")) return "connector"
  return "other"
}

// ---------------------------------------------------------------------------
// Thread dump mapping
// ---------------------------------------------------------------------------

/**
 * Map GET /thread-dump response → domain ThreadDumpInfo.
 */
export function mapThreadDump(api: FlinkThreadDumpResponse): ThreadDumpInfo {
  return {
    threadInfos: (api.threadInfos ?? []).map((t) => ({
      threadName: t.threadName,
      stringifiedThreadInfo: t.stringifiedThreadInfo,
    })),
  }
}

// ---------------------------------------------------------------------------
// Log file list mapping
// ---------------------------------------------------------------------------

/**
 * Map GET /logs response → domain LogFileEntry[].
 */
export function mapLogFileList(api: FlinkLogListResponse): LogFileEntry[] {
  return (api.logs ?? []).map((f) => ({
    name: f.name,
    lastModified: new Date(), // Flink doesn't provide last-modified; use current time
    size: Math.round(f.size / 1024), // API returns bytes, domain uses KB
  }))
}

// ---------------------------------------------------------------------------
// Cluster config / feature flags mapping
// ---------------------------------------------------------------------------

/**
 * Map GET /config response → FlinkFeatureFlags.
 * Flink's /config endpoint returns a DashboardConfiguration object with a
 * nested `features` map keyed by "web-submit", "web-cancel", etc.
 */
export function mapClusterConfig(
  api: FlinkClusterConfigResponse,
): FlinkFeatureFlags {
  const f = api.features ?? {}
  return {
    webSubmit: f["web-submit"] !== false,
    webCancel: f["web-cancel"] !== false,
    webRescale: f["web-rescale"] === true,
    webHistory: f["web-history"] === true,
    webProfiler: false, // Not exposed in /config features; always false
  }
}

// ---------------------------------------------------------------------------
// Checkpoint detail mapping
// ---------------------------------------------------------------------------

/**
 * Map GET /jobs/:jid/checkpoints/:cpid/details → domain CheckpointDetail.
 */
export function mapCheckpointDetail(
  api: FlinkCheckpointDetailResponse,
): CheckpointDetail {
  const tasks: Record<string, CheckpointTaskDetail> = {}
  for (const [vid, t] of Object.entries(api.tasks)) {
    tasks[vid] = {
      vertexId: t.id,
      status: t.status,
      latestAckTimestamp: t.latest_ack_timestamp,
      stateSize: t.state_size,
      endToEndDuration: t.end_to_end_duration,
      numSubtasks: t.num_subtasks,
      numAcknowledgedSubtasks: t.num_acknowledged_subtasks,
    }
  }

  const status = (
    ["COMPLETED", "IN_PROGRESS", "FAILED"].includes(api.status)
      ? api.status
      : "IN_PROGRESS"
  ) as CheckpointStatus

  return {
    id: api.id,
    status,
    isSavepoint: api.is_savepoint,
    triggerTimestamp: new Date(api.trigger_timestamp),
    latestAckTimestamp: new Date(api.latest_ack_timestamp),
    stateSize: api.state_size,
    endToEndDuration: api.end_to_end_duration,
    numSubtasks: api.num_subtasks,
    numAcknowledgedSubtasks: api.num_acknowledged_subtasks,
    tasks,
  }
}

// ---------------------------------------------------------------------------
// Subtask times mapping
// ---------------------------------------------------------------------------

/**
 * Map GET /jobs/:jid/vertices/:vid/subtasktimes → domain SubtaskTimeline.
 */
export function mapSubtaskTimes(
  api: FlinkSubtaskTimesResponse,
): SubtaskTimeline {
  return {
    vertexId: api.id,
    vertexName: api.name,
    now: api.now,
    subtasks: (api.subtasks ?? []).map((s) => ({
      subtask: s.subtask,
      host: s.host,
      duration: s.duration,
      timestamps: s.timestamps,
    })),
  }
}

// ---------------------------------------------------------------------------
// Flamegraph mapping
// ---------------------------------------------------------------------------

function mapFlamegraphNode(node: FlinkFlamegraphNode): FlamegraphNode {
  return {
    name: node.name,
    value: node.value,
    children: (node.children ?? []).map(mapFlamegraphNode),
  }
}

/**
 * Map GET /jobs/:jid/vertices/:vid/flamegraph → domain FlamegraphData.
 */
export function mapFlamegraph(api: FlinkFlamegraphResponse): FlamegraphData {
  return {
    endTimestamp: api["end-timestamp"],
    root: mapFlamegraphNode(api.data),
  }
}

// ---------------------------------------------------------------------------
// JAR list mapping
// ---------------------------------------------------------------------------

/**
 * Map GET /jars → domain UploadedJar[].
 */
export function mapJars(api: FlinkJarsResponse): UploadedJar[] {
  return (api.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    uploadTime: new Date(f.uploaded),
    entryClasses: (f.entry ?? []).map((e) => e.name),
  }))
}
