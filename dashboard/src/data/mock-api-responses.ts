// ---------------------------------------------------------------------------
// Mock generators that produce data in Flink REST API format.
// Used by proxy routes when mockMode=true so the full pipeline is exercised.
// ---------------------------------------------------------------------------

import type {
  Checkpoint,
  CheckpointConfig,
  ClusterOverview,
  FlinkJob,
  JobConfiguration,
  JobEdge,
  JobException,
  JobPlan,
  JobVertex,
  SubtaskMetrics,
  TaskCounts,
  TaskManager,
  UserAccumulator,
  VertexBackPressure,
  VertexWatermark,
} from "./cluster-types"
import type {
  FlinkCheckpointConfigResponse,
  FlinkCheckpointDetailResponse,
  FlinkCheckpointingStatistics,
  FlinkClusterConfigResponse,
  FlinkFlamegraphResponse,
  FlinkJarRunResponse,
  FlinkJarsResponse,
  FlinkJarUploadResponse,
  FlinkJobConfigResponse,
  FlinkJobDetailAggregate,
  FlinkJobDetailResponse,
  FlinkJobExceptionsResponse,
  FlinkJobManagerDetailAggregate,
  FlinkJobPlan,
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
  FlinkVertexMetrics,
  FlinkWatermarksResponse,
} from "./flink-api-types"
import {
  generateAccumulators,
  generateBackPressure,
  generateCheckpoints,
  generateClusterOverview,
  generateCompletedJobs,
  generateJobConfiguration,
  generateJobExceptions,
  generateJobManagerInfo,
  generateJobPlan,
  generateRunningJobs,
  generateSubtaskMetrics,
  generateTaskManagers,
  generateWatermarks,
} from "./mock-cluster"

// ---------------------------------------------------------------------------
// Reverse mappers: domain types → API format
// ---------------------------------------------------------------------------

function domainTaskCountsToApi(tc: TaskCounts): FlinkTaskCounts {
  return {
    created: 0,
    scheduled: 0,
    deploying: 0,
    running: tc.running,
    finished: tc.finished,
    canceling: tc.canceling,
    canceled: 0,
    failed: tc.failed,
    reconciling: 0,
    initializing: 0,
    // Put all pending into "scheduled" to round-trip correctly
    ...(tc.pending > 0 ? { scheduled: tc.pending } : {}),
  }
}

function overviewToApi(o: ClusterOverview): FlinkOverviewResponse {
  return {
    "flink-version": o.flinkVersion,
    "flink-commit": o.flinkCommitId,
    "slots-total": o.totalTaskSlots,
    "slots-available": o.availableTaskSlots,
    "jobs-running": o.runningJobs,
    "jobs-finished": o.finishedJobs,
    "jobs-cancelled": o.cancelledJobs,
    "jobs-failed": o.failedJobs,
    taskmanagers: o.taskManagerCount,
  }
}

function jobsToApi(jobs: FlinkJob[]): FlinkJobsOverviewResponse {
  return {
    jobs: jobs.map((j) => ({
      jid: j.id,
      name: j.name,
      state: j.status,
      "start-time": j.startTime.getTime(),
      "end-time": j.endTime ? j.endTime.getTime() : -1,
      duration: j.duration,
      "last-modification": j.endTime
        ? j.endTime.getTime()
        : j.startTime.getTime(),
      tasks: domainTaskCountsToApi(j.tasks),
    })),
  }
}

// ---------------------------------------------------------------------------
// Public generators — called by proxy routes
// ---------------------------------------------------------------------------

export function generateMockOverviewApiResponse(): FlinkOverviewResponse {
  const tms = generateTaskManagers()
  const running = generateRunningJobs()
  const completed = generateCompletedJobs()
  const overview = generateClusterOverview(running, completed, tms)
  return overviewToApi(overview)
}

export function generateMockJobsOverviewApiResponse(): FlinkJobsOverviewResponse {
  const running = generateRunningJobs()
  const completed = generateCompletedJobs()
  return jobsToApi([...running, ...completed])
}

// ---------------------------------------------------------------------------
// Job detail reverse mappers: domain → API format
// ---------------------------------------------------------------------------

function domainTaskCountsToUppercase(tc: TaskCounts): Record<string, number> {
  return {
    CREATED: 0,
    SCHEDULED: tc.pending,
    DEPLOYING: 0,
    RUNNING: tc.running,
    FINISHED: tc.finished,
    CANCELING: tc.canceling,
    CANCELED: 0,
    FAILED: tc.failed,
    RECONCILING: 0,
    INITIALIZING: 0,
  }
}

function domainVertexToApi(
  v: JobVertex,
  jobDurationMs: number,
): FlinkVertexInfo {
  const durationSec = Math.max(1, jobDurationMs / 1000)
  const metrics: FlinkVertexMetrics = {
    "read-bytes": v.metrics.bytesIn,
    "read-bytes-complete": true,
    "write-bytes": v.metrics.bytesOut,
    "write-bytes-complete": true,
    "read-records": v.metrics.recordsIn,
    "read-records-complete": true,
    "write-records": v.metrics.recordsOut,
    "write-records-complete": true,
    "accumulated-backpressured-time": Math.round(
      v.metrics.backPressuredTimeMsPerSecond * durationSec,
    ),
    "accumulated-idle-time": 0,
    "accumulated-busy-time": Math.round(
      v.metrics.busyTimeMsPerSecond * durationSec,
    ),
  }

  return {
    id: v.id,
    name: v.name,
    maxParallelism: v.parallelism * 4,
    parallelism: v.parallelism,
    status: v.status,
    "start-time": v.startTime,
    "end-time": v.status === "RUNNING" ? -1 : v.startTime + v.duration,
    duration: v.duration,
    tasks: domainTaskCountsToUppercase(v.tasks),
    metrics,
  }
}

function domainPlanToApi(
  plan: JobPlan,
  jobId: string,
  jobName: string,
  edges: JobEdge[],
): FlinkJobPlan {
  // Build a lookup: target → edges arriving at that target
  const edgesByTarget = new Map<string, JobEdge[]>()
  for (const e of edges) {
    const list = edgesByTarget.get(e.target) ?? []
    list.push(e)
    edgesByTarget.set(e.target, list)
  }

  const nodes: FlinkPlanNode[] = plan.vertices.map((v, _i) => {
    const incoming = edgesByTarget.get(v.id) ?? []
    return {
      id: v.id,
      parallelism: v.parallelism,
      operator: v.name,
      operator_strategy: "NONE",
      description: v.name,
      ...(incoming.length > 0
        ? {
            inputs: incoming.map((e, idx) => ({
              num: idx,
              id: e.source,
              ship_strategy: e.shipStrategy,
              exchange: "pipelined",
            })),
          }
        : {}),
    }
  })

  return { jid: jobId, name: jobName, type: "STREAMING", nodes }
}

function domainExceptionsToApi(
  exceptions: JobException[],
): FlinkJobExceptionsResponse {
  return {
    exceptionHistory: {
      entries: exceptions.map((e) => ({
        exceptionName: e.name,
        stacktrace: e.stacktrace,
        timestamp: e.timestamp.getTime(),
        taskName: e.taskName,
        endpoint: e.location,
        taskManagerId: null,
        failureLabels: {},
      })),
      truncated: false,
    },
  }
}

function domainCheckpointsToApi(
  checkpoints: Checkpoint[],
): FlinkCheckpointingStatistics {
  return {
    counts: {
      completed: checkpoints.filter((c) => c.status === "COMPLETED").length,
      in_progress: checkpoints.filter((c) => c.status === "IN_PROGRESS").length,
      failed: checkpoints.filter((c) => c.status === "FAILED").length,
      total: checkpoints.length,
    },
    history: checkpoints.map((c) => ({
      id: c.id,
      status: c.status,
      is_savepoint: c.isSavepoint,
      trigger_timestamp: c.triggerTimestamp.getTime(),
      latest_ack_timestamp: c.triggerTimestamp.getTime() + c.duration,
      state_size: c.size,
      end_to_end_duration: c.duration,
      processed_data: c.processedData,
      persisted_data: c.size,
      num_subtasks: 4,
      num_acknowledged_subtasks: c.status === "IN_PROGRESS" ? 2 : 4,
    })),
  }
}

function domainCheckpointConfigToApi(
  config: CheckpointConfig,
): FlinkCheckpointConfigResponse {
  return {
    mode: config.mode,
    interval: config.interval,
    timeout: config.timeout,
    min_pause: config.minPause,
    max_concurrent: config.maxConcurrent,
    externalization: {
      enabled: true,
      delete_on_cancellation: false,
    },
    unaligned_checkpoints: true,
  }
}

function domainJobConfigToApi(
  configuration: JobConfiguration[],
  jobId: string,
  jobName: string,
): FlinkJobConfigResponse {
  const userConfig: Record<string, string> = {}
  for (const c of configuration) {
    userConfig[c.key] = c.value
  }
  return {
    jid: jobId,
    name: jobName,
    "execution-config": {
      "execution-mode": "PIPELINED",
      "restart-strategy": "fixed-delay",
      "job-parallelism": 4,
      "object-reuse-mode": true,
      "user-config": userConfig,
    },
  }
}

function domainSubtaskMetricsToApi(
  subtaskMetrics: Record<string, SubtaskMetrics[]>,
  vertices: JobVertex[],
): Record<string, FlinkVertexDetailResponse> {
  const result: Record<string, FlinkVertexDetailResponse> = {}
  const now = Date.now()

  for (const vertex of vertices) {
    const subtasks = subtaskMetrics[vertex.id] ?? []
    result[vertex.id] = {
      id: vertex.id,
      name: vertex.name,
      parallelism: vertex.parallelism,
      now,
      subtasks: subtasks.map((s) => {
        const durationSec = Math.max(1, s.duration / 1000)
        return {
          subtask: s.subtaskIndex,
          status: s.status,
          attempt: s.attempt,
          endpoint: s.endpoint,
          "start-time": s.startTime,
          "end-time": s.endTime,
          duration: s.duration,
          metrics: {
            "read-bytes": s.bytesIn,
            "read-bytes-complete": true,
            "write-bytes": s.bytesOut,
            "write-bytes-complete": true,
            "read-records": s.recordsIn,
            "read-records-complete": true,
            "write-records": s.recordsOut,
            "write-records-complete": true,
            "accumulated-backpressured-time": Math.round(
              s.backPressuredTimeMsPerSecond * durationSec,
            ),
            "accumulated-idle-time": Math.round(
              s.idleTimeMsPerSecond * durationSec,
            ),
            "accumulated-busy-time": Math.round(
              s.busyTimeMsPerSecond * durationSec,
            ),
          },
          "taskmanager-id": s.taskManagerId,
        }
      }),
    }
  }

  return result
}

function domainWatermarksToApi(
  watermarks: Record<string, VertexWatermark[]>,
): Record<string, FlinkWatermarksResponse> {
  const result: Record<string, FlinkWatermarksResponse> = {}

  for (const [vertexId, wms] of Object.entries(watermarks)) {
    result[vertexId] = wms.map((w) => ({
      id: `${w.subtaskIndex}.currentInputWatermark`,
      value:
        w.watermark === -Infinity
          ? "-9223372036854775808"
          : String(w.watermark),
    }))
  }

  return result
}

function domainBackPressureToApi(
  backpressure: Record<string, VertexBackPressure>,
): Record<string, FlinkVertexBackPressureResponse> {
  const result: Record<string, FlinkVertexBackPressureResponse> = {}

  for (const [vertexId, bp] of Object.entries(backpressure)) {
    result[vertexId] = {
      status: "ok",
      backpressureLevel: bp.level,
      "end-timestamp": bp.endTimestamp,
      subtasks: bp.subtasks.map((s) => ({
        subtask: s.subtaskIndex,
        "attempt-number": 0,
        backpressureLevel: s.level,
        ratio: s.ratio,
        busyRatio: s.busyRatio,
        idleRatio: s.idleRatio,
      })),
    }
  }

  return result
}

function domainAccumulatorsToApi(
  accumulators: Record<string, UserAccumulator[]>,
): Record<string, FlinkVertexAccumulatorsResponse> {
  const result: Record<string, FlinkVertexAccumulatorsResponse> = {}

  for (const [vertexId, accs] of Object.entries(accumulators)) {
    result[vertexId] = {
      id: vertexId,
      "user-accumulators": accs.map((a) => ({
        name: a.name,
        type: a.type,
        value: a.value,
      })),
    }
  }

  return result
}

// ---------------------------------------------------------------------------
// Public mock generator for job detail aggregate
// ---------------------------------------------------------------------------

/**
 * Generate a mock FlinkJobDetailAggregate for a given job ID.
 * Uses domain generators, then reverse-maps to API format.
 */
export function generateMockJobDetailApiResponse(
  jobId: string,
): FlinkJobDetailAggregate {
  // Find the job in our mock data (or generate a default one)
  const running = generateRunningJobs()
  const completed = generateCompletedJobs()
  const allJobs = [...running, ...completed]
  const domainJob = allJobs.find((j) => j.id === jobId)

  // If job not found, generate a standalone one (shouldn't happen in practice)
  const jobName = domainJob?.name ?? "UnknownJob"
  const jobStatus = domainJob?.status ?? "RUNNING"
  const startTime = domainJob?.startTime ?? new Date()
  const endTime = domainJob?.endTime
  const duration = domainJob?.duration ?? 60_000
  const parallelism = domainJob?.parallelism ?? 4

  // Generate domain detail data
  const plan = generateJobPlan(parallelism, jobStatus, startTime)
  const exceptions = generateJobExceptions(jobStatus, plan.vertices)
  const { checkpoints, config: ckpConfig } = generateCheckpoints(jobStatus)
  const subtaskMetrics = generateSubtaskMetrics(plan.vertices)
  const configuration = generateJobConfiguration()
  const watermarks = generateWatermarks(plan.vertices)
  const backpressure = generateBackPressure(plan.vertices)
  const accumulators = generateAccumulators(plan.vertices)

  // Reverse-map to API format
  const apiVertices = plan.vertices.map((v) => domainVertexToApi(v, duration))
  const apiPlan = domainPlanToApi(plan, jobId, jobName, plan.edges)

  // Assemble status-counts from all vertices
  const statusCounts: Record<string, number> = {}
  for (const v of apiVertices) {
    for (const [state, count] of Object.entries(v.tasks)) {
      statusCounts[state] = (statusCounts[state] ?? 0) + count
    }
  }

  const jobResponse: FlinkJobDetailResponse = {
    jid: jobId,
    name: jobName,
    state: jobStatus,
    "start-time": startTime.getTime(),
    "end-time": endTime ? endTime.getTime() : -1,
    duration,
    now: Date.now(),
    timestamps: { [jobStatus]: startTime.getTime() },
    vertices: apiVertices,
    "status-counts": statusCounts,
    plan: apiPlan,
  }

  return {
    job: jobResponse,
    exceptions: domainExceptionsToApi(exceptions),
    checkpoints: domainCheckpointsToApi(checkpoints),
    checkpointConfig: domainCheckpointConfigToApi(ckpConfig),
    jobConfig: domainJobConfigToApi(configuration, jobId, jobName),
    vertexDetails: domainSubtaskMetricsToApi(subtaskMetrics, plan.vertices),
    watermarks: domainWatermarksToApi(watermarks),
    backpressure: domainBackPressureToApi(backpressure),
    accumulators: domainAccumulatorsToApi(accumulators),
  }
}

// ---------------------------------------------------------------------------
// Task Manager mock API responses
// ---------------------------------------------------------------------------

function domainTmToApiItem(tm: TaskManager) {
  return {
    id: tm.id,
    path: tm.path,
    dataPort: tm.dataPort,
    jmxPort: tm.jmxPort,
    timeSinceLastHeartbeat: Date.now() - tm.lastHeartbeat.getTime(),
    slotsNumber: tm.slotsTotal,
    freeSlots: tm.slotsFree,
    totalResource: tm.totalResource,
    freeResource: tm.freeResource,
    hardware: {
      cpuCores: tm.cpuCores,
      physicalMemory: tm.physicalMemory,
      freeMemory: tm.freeMemory,
      managedMemory: tm.memoryConfiguration.managedMemory,
    },
    memoryConfiguration: tm.memoryConfiguration,
    allocatedSlots: tm.allocatedSlots.map((s) => ({
      index: s.index,
      jobId: s.jobId,
      resource: s.resource,
    })),
  }
}

function domainTmMetricsToApi(tm: TaskManager): FlinkMetricItem[] {
  const m = tm.metrics
  const items: FlinkMetricItem[] = [
    { id: "Status.JVM.CPU.Load", value: String(m.cpuUsage / 100) },
    { id: "Status.JVM.Memory.Heap.Used", value: String(m.heapUsed) },
    { id: "Status.JVM.Memory.Heap.Committed", value: String(m.heapCommitted) },
    { id: "Status.JVM.Memory.Heap.Max", value: String(m.heapMax) },
    { id: "Status.JVM.Memory.NonHeap.Used", value: String(m.nonHeapUsed) },
    {
      id: "Status.JVM.Memory.NonHeap.Committed",
      value: String(m.nonHeapCommitted),
    },
    { id: "Status.JVM.Memory.NonHeap.Max", value: String(m.nonHeapMax) },
    { id: "Status.JVM.Memory.Direct.Count", value: String(m.directCount) },
    { id: "Status.JVM.Memory.Direct.MemoryUsed", value: String(m.directUsed) },
    {
      id: "Status.JVM.Memory.Direct.TotalCapacity",
      value: String(m.directMax),
    },
    { id: "Status.JVM.Memory.Mapped.Count", value: String(m.mappedCount) },
    { id: "Status.JVM.Memory.Mapped.MemoryUsed", value: String(m.mappedUsed) },
    {
      id: "Status.JVM.Memory.Mapped.TotalCapacity",
      value: String(m.mappedMax),
    },
    {
      id: "Status.Shuffle.Netty.AvailableMemory",
      value: String(m.nettyShuffleMemoryAvailable),
    },
    {
      id: "Status.Shuffle.Netty.UsedMemory",
      value: String(m.nettyShuffleMemoryUsed),
    },
    {
      id: "Status.Shuffle.Netty.TotalMemory",
      value: String(m.nettyShuffleMemoryTotal),
    },
    {
      id: "Status.Shuffle.Netty.AvailableMemorySegments",
      value: String(m.nettyShuffleSegmentsAvailable),
    },
    {
      id: "Status.Shuffle.Netty.UsedMemorySegments",
      value: String(m.nettyShuffleSegmentsUsed),
    },
    {
      id: "Status.Shuffle.Netty.TotalMemorySegments",
      value: String(m.nettyShuffleSegmentsTotal),
    },
    {
      id: "Status.Flink.Memory.Managed.Used",
      value: String(m.managedMemoryUsed),
    },
    {
      id: "Status.Flink.Memory.Managed.Total",
      value: String(m.managedMemoryTotal),
    },
    { id: "Status.JVM.Memory.Metaspace.Used", value: String(m.metaspaceUsed) },
    { id: "Status.JVM.Memory.Metaspace.Max", value: String(m.metaspaceMax) },
    { id: "Status.JVM.Threads.Count", value: String(m.threadCount) },
  ]

  for (const gc of m.garbageCollectors) {
    items.push(
      {
        id: `Status.JVM.GarbageCollector.${gc.name}.Count`,
        value: String(gc.count),
      },
      {
        id: `Status.JVM.GarbageCollector.${gc.name}.Time`,
        value: String(gc.time),
      },
    )
  }

  return items
}

export function generateMockTaskManagersApiResponse(): FlinkTaskManagersResponse {
  const tms = generateTaskManagers()
  return { taskmanagers: tms.map(domainTmToApiItem) }
}

export function generateMockTaskManagerDetailApiResponse(
  tmId: string,
): FlinkTaskManagerDetailAggregate {
  const tms = generateTaskManagers()
  const tm = tms.find((t) => t.id === tmId) ?? tms[0]
  return {
    detail: domainTmToApiItem(tm),
    metrics: domainTmMetricsToApi(tm),
  }
}

export function generateMockTaskManagerMetricsApiResponse(
  tmId: string,
): FlinkMetricItem[] {
  const tms = generateTaskManagers()
  const tm = tms.find((t) => t.id === tmId) ?? tms[0]
  return domainTmMetricsToApi(tm)
}

export function generateMockThreadDumpApiResponse(
  source: "taskmanager" | "jobmanager",
  tmId?: string,
): FlinkThreadDumpResponse {
  if (source === "taskmanager") {
    const tms = generateTaskManagers()
    const tm = tms.find((t) => t.id === tmId) ?? tms[0]
    return { threadInfos: tm.threadDump.threadInfos }
  }
  const jm = generateJobManagerInfo()
  return { threadInfos: jm.threadDump.threadInfos }
}

export function generateMockLogListApiResponse(
  source: "taskmanager" | "jobmanager",
  tmId?: string,
): FlinkLogListResponse {
  if (source === "taskmanager") {
    const tms = generateTaskManagers()
    const tm = tms.find((t) => t.id === tmId) ?? tms[0]
    return {
      logs: tm.logFiles.map((f) => ({
        name: f.name,
        size: f.size * 1024, // domain uses KB, API uses bytes
      })),
    }
  }
  const jm = generateJobManagerInfo()
  return {
    logs: jm.logFiles.map((f) => ({
      name: f.name,
      size: f.size * 1024,
    })),
  }
}

export function generateMockLogTextApiResponse(
  source: "taskmanager" | "jobmanager",
  variant: "log" | "stdout",
  tmId?: string,
): string {
  if (source === "taskmanager") {
    const tms = generateTaskManagers()
    const tm = tms.find((t) => t.id === tmId) ?? tms[0]
    return variant === "log" ? tm.logs : tm.stdout
  }
  const jm = generateJobManagerInfo()
  return variant === "log" ? jm.logs : jm.stdout
}

export function generateMockLogFileContentApiResponse(
  source: "taskmanager" | "jobmanager",
  _logName: string,
  tmId?: string,
): string {
  // In mock mode, return a subset of the main log
  if (source === "taskmanager") {
    const tms = generateTaskManagers()
    const tm = tms.find((t) => t.id === tmId) ?? tms[0]
    return tm.logs.split("\n").slice(0, 200).join("\n")
  }
  const jm = generateJobManagerInfo()
  return jm.logs.split("\n").slice(0, 200).join("\n")
}

// ---------------------------------------------------------------------------
// Job Manager mock API responses
// ---------------------------------------------------------------------------

export function generateMockJobManagerDetailApiResponse(): FlinkJobManagerDetailAggregate {
  const jm = generateJobManagerInfo()

  const config: FlinkClusterConfigResponse = jm.config.map((c) => ({
    key: c.key,
    value: c.value,
  }))

  const systemProperties: Record<string, string> = {}
  for (const sp of jm.jvm.systemProperties) {
    systemProperties[sp.key] = sp.value
  }

  const environment = {
    jvm: {
      version: "17.0.9+9",
      arch: "amd64",
      options: jm.jvm.arguments,
    },
    classpath: jm.classpath.map((c) => c.path),
    "system-properties": systemProperties,
  }

  const m = jm.metrics
  const latestHeapUsed = m.jvmHeapUsed[m.jvmHeapUsed.length - 1]?.value ?? 0
  const latestNonHeapUsed =
    m.jvmNonHeapUsed[m.jvmNonHeapUsed.length - 1]?.value ?? 0
  const latestThreadCount = m.threadCount[m.threadCount.length - 1]?.value ?? 0
  const latestGcCount = m.gcCount[m.gcCount.length - 1]?.value ?? 0
  const latestGcTime = m.gcTime[m.gcTime.length - 1]?.value ?? 0

  const metrics: FlinkMetricItem[] = [
    { id: "Status.JVM.Memory.Heap.Used", value: String(latestHeapUsed) },
    { id: "Status.JVM.Memory.Heap.Max", value: String(m.jvmHeapMax) },
    { id: "Status.JVM.Memory.NonHeap.Used", value: String(latestNonHeapUsed) },
    { id: "Status.JVM.Memory.NonHeap.Max", value: String(m.jvmNonHeapMax) },
    {
      id: "Status.JVM.Memory.Metaspace.Used",
      value: String(jm.jvm.memoryConfig.metaspaceUsed),
    },
    {
      id: "Status.JVM.Memory.Metaspace.Max",
      value: String(jm.jvm.memoryConfig.metaspaceMax),
    },
    {
      id: "Status.JVM.Memory.Direct.MemoryUsed",
      value: String(jm.jvm.memoryConfig.directUsed),
    },
    {
      id: "Status.JVM.Memory.Direct.TotalCapacity",
      value: String(jm.jvm.memoryConfig.directMax),
    },
    { id: "Status.JVM.Threads.Count", value: String(latestThreadCount) },
    {
      id: "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
      value: String(latestGcCount),
    },
    {
      id: "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
      value: String(latestGcTime),
    },
  ]

  return { config, environment, metrics }
}

export function generateMockJobManagerMetricsApiResponse(): FlinkMetricItem[] {
  const jm = generateJobManagerInfo()
  const m = jm.metrics
  const latestHeapUsed = m.jvmHeapUsed[m.jvmHeapUsed.length - 1]?.value ?? 0
  const latestNonHeapUsed =
    m.jvmNonHeapUsed[m.jvmNonHeapUsed.length - 1]?.value ?? 0
  const latestThreadCount = m.threadCount[m.threadCount.length - 1]?.value ?? 0
  const latestGcCount = m.gcCount[m.gcCount.length - 1]?.value ?? 0
  const latestGcTime = m.gcTime[m.gcTime.length - 1]?.value ?? 0

  return [
    { id: "Status.JVM.Memory.Heap.Used", value: String(latestHeapUsed) },
    { id: "Status.JVM.Memory.Heap.Max", value: String(m.jvmHeapMax) },
    { id: "Status.JVM.Memory.NonHeap.Used", value: String(latestNonHeapUsed) },
    { id: "Status.JVM.Memory.NonHeap.Max", value: String(m.jvmNonHeapMax) },
    {
      id: "Status.JVM.Memory.Metaspace.Used",
      value: String(jm.jvm.memoryConfig.metaspaceUsed),
    },
    {
      id: "Status.JVM.Memory.Metaspace.Max",
      value: String(jm.jvm.memoryConfig.metaspaceMax),
    },
    {
      id: "Status.JVM.Memory.Direct.MemoryUsed",
      value: String(jm.jvm.memoryConfig.directUsed),
    },
    {
      id: "Status.JVM.Memory.Direct.TotalCapacity",
      value: String(jm.jvm.memoryConfig.directMax),
    },
    { id: "Status.JVM.Threads.Count", value: String(latestThreadCount) },
    {
      id: "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
      value: String(latestGcCount),
    },
    {
      id: "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
      value: String(latestGcTime),
    },
  ]
}

// ---------------------------------------------------------------------------
// Cluster config mock API response
// ---------------------------------------------------------------------------

export function generateMockClusterConfigApiResponse(): FlinkClusterConfigResponse {
  return [
    { key: "web.submit.enable", value: "true" },
    { key: "web.cancel.enable", value: "true" },
    { key: "web.rescale.enable", value: "false" },
    { key: "web.history", value: "false" },
    { key: "web.profiler.enable", value: "false" },
    { key: "taskmanager.numberOfTaskSlots", value: "4" },
    { key: "parallelism.default", value: "1" },
    { key: "jobmanager.rpc.address", value: "localhost" },
    { key: "jobmanager.rpc.port", value: "6123" },
    { key: "jobmanager.memory.process.size", value: "1600m" },
    { key: "taskmanager.memory.process.size", value: "1728m" },
  ]
}

// ---------------------------------------------------------------------------
// Checkpoint detail mock API response
// ---------------------------------------------------------------------------

export function generateMockCheckpointDetailApiResponse(
  checkpointId: number,
): FlinkCheckpointDetailResponse {
  const now = Date.now()
  // Use vertex IDs from the first mock job
  const vertexIds = [
    "bc764cd8ddf7a0cff126f51c16239658",
    "0a448493b4782967b150582570326227",
    "6d2677a0ecc3fd8df0b72ec675edf8f4",
    "ea632d67b7d595e5b851708ae9ad4571",
  ]

  const tasks: Record<string, FlinkCheckpointDetailResponse["tasks"][string]> =
    {}
  for (const vid of vertexIds) {
    tasks[vid] = {
      id: vid,
      status: "COMPLETED",
      latest_ack_timestamp: now - 500,
      state_size: Math.floor(Math.random() * 5_000_000) + 100_000,
      end_to_end_duration: Math.floor(Math.random() * 3000) + 200,
      num_subtasks: 4,
      num_acknowledged_subtasks: 4,
    }
  }

  return {
    id: checkpointId,
    status: "COMPLETED",
    is_savepoint: false,
    trigger_timestamp: now - 5000,
    latest_ack_timestamp: now - 500,
    state_size: Object.values(tasks).reduce((sum, t) => sum + t.state_size, 0),
    end_to_end_duration: 4500,
    num_subtasks: 16,
    num_acknowledged_subtasks: 16,
    tasks,
  }
}

// ---------------------------------------------------------------------------
// Subtask times mock API response
// ---------------------------------------------------------------------------

export function generateMockSubtaskTimesApiResponse(
  vertexId: string,
): FlinkSubtaskTimesResponse {
  const now = Date.now()
  const states = [
    "CREATED",
    "SCHEDULED",
    "DEPLOYING",
    "INITIALIZING",
    "RUNNING",
  ]
  const subtasks = Array.from({ length: 4 }, (_, i) => {
    const timestamps: Record<string, number> = {}
    let t = now - 60_000 - Math.floor(Math.random() * 5000)
    for (const state of states) {
      timestamps[state] = t
      t += Math.floor(Math.random() * 1000) + 100
    }
    return {
      subtask: i,
      host: `taskmanager-${i % 2}:6121`,
      duration: now - timestamps.CREATED,
      timestamps,
    }
  })

  return {
    id: vertexId,
    name: `Vertex ${vertexId.slice(0, 8)}`,
    now,
    subtasks,
  }
}

// ---------------------------------------------------------------------------
// Flamegraph mock API response
// ---------------------------------------------------------------------------

export function generateMockFlamegraphApiResponse(): FlinkFlamegraphResponse {
  return {
    "end-timestamp": Date.now(),
    data: {
      name: "root",
      value: 1000,
      children: [
        {
          name: "org.apache.flink.streaming.runtime.tasks.StreamTask.run",
          value: 800,
          children: [
            {
              name: "org.apache.flink.streaming.runtime.tasks.mailbox.MailboxProcessor.runMailboxLoop",
              value: 600,
              children: [
                {
                  name: "org.apache.flink.streaming.runtime.tasks.StreamTask.processInput",
                  value: 400,
                  children: [
                    {
                      name: "org.apache.flink.api.common.functions.MapFunction.map",
                      value: 250,
                    },
                    {
                      name: "org.apache.flink.streaming.api.operators.StreamSink.processElement",
                      value: 150,
                    },
                  ],
                },
                {
                  name: "org.apache.flink.runtime.io.network.partition.consumer.InputGate.pollNext",
                  value: 200,
                },
              ],
            },
            {
              name: "org.apache.flink.streaming.runtime.tasks.StreamTask.triggerCheckpoint",
              value: 200,
            },
          ],
        },
        {
          name: "java.lang.Thread.sleep",
          value: 100,
        },
        {
          name: "org.apache.flink.runtime.taskmanager.Task.run",
          value: 100,
        },
      ],
    },
  }
}

// ---------------------------------------------------------------------------
// Vertex metrics mock API response
// ---------------------------------------------------------------------------

export function generateMockVertexMetricsApiResponse(): FlinkMetricItem[] {
  return [
    {
      id: "numRecordsInPerSecond",
      value: String(Math.floor(Math.random() * 10000) + 500),
    },
    {
      id: "numRecordsOutPerSecond",
      value: String(Math.floor(Math.random() * 10000) + 400),
    },
    {
      id: "numBytesInPerSecond",
      value: String(Math.floor(Math.random() * 5_000_000) + 100_000),
    },
    {
      id: "numBytesOutPerSecond",
      value: String(Math.floor(Math.random() * 5_000_000) + 80_000),
    },
    {
      id: "busyTimeMsPerSecond",
      value: String(Math.floor(Math.random() * 800) + 100),
    },
    {
      id: "backPressuredTimeMsPerSecond",
      value: String(Math.floor(Math.random() * 200)),
    },
    {
      id: "idleTimeMsPerSecond",
      value: String(Math.floor(Math.random() * 300)),
    },
    {
      id: "currentInputWatermark",
      value: String(Date.now() - Math.floor(Math.random() * 5000)),
    },
  ]
}

// ---------------------------------------------------------------------------
// JAR management mock API responses
// ---------------------------------------------------------------------------

export function generateMockJarsApiResponse(): FlinkJarsResponse {
  return {
    address: "http://localhost:8081",
    files: [
      {
        id: "7a9e2a10-6e66-4b3e-a7de-3b84e9e1c2f5_WordCount.jar",
        name: "WordCount.jar",
        uploaded: Date.now() - 3_600_000,
        entry: [
          {
            name: "org.apache.flink.examples.java.wordcount.WordCount",
            description: null,
          },
        ],
      },
      {
        id: "c3f2b1a0-8d44-4e2a-b5c1-9f8e7d6c5b4a_TopSpeedWindowing.jar",
        name: "TopSpeedWindowing.jar",
        uploaded: Date.now() - 7_200_000,
        entry: [
          {
            name: "org.apache.flink.streaming.examples.windowing.TopSpeedWindowing",
            description: null,
          },
        ],
      },
    ],
  }
}

export function generateMockJarUploadApiResponse(
  filename: string,
): FlinkJarUploadResponse {
  return {
    filename: `/tmp/flink-web-upload/${crypto.randomUUID()}_${filename}`,
    status: "success",
  }
}

export function generateMockJarRunApiResponse(): FlinkJarRunResponse {
  const hex = Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("")
  return { jobid: hex }
}

// ---------------------------------------------------------------------------
// Metrics Explorer — mock metric list and time-varying values
// ---------------------------------------------------------------------------

const JM_METRIC_NAMES = [
  "Status.JVM.Memory.Heap.Used",
  "Status.JVM.Memory.Heap.Max",
  "Status.JVM.Memory.Heap.Committed",
  "Status.JVM.Memory.NonHeap.Used",
  "Status.JVM.Memory.NonHeap.Max",
  "Status.JVM.Memory.Metaspace.Used",
  "Status.JVM.Memory.Metaspace.Max",
  "Status.JVM.Memory.Direct.MemoryUsed",
  "Status.JVM.Memory.Direct.TotalCapacity",
  "Status.JVM.Threads.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
  "Status.JVM.CPU.Load",
  "Status.Shuffle.Netty.UsedMemory",
  "Status.Shuffle.Netty.AvailableMemory",
  "Status.Network.AvailableMemorySegments",
  "Status.Network.TotalMemorySegments",
]

const TM_METRIC_NAMES = [
  "Status.JVM.CPU.Load",
  "Status.JVM.Memory.Heap.Used",
  "Status.JVM.Memory.Heap.Committed",
  "Status.JVM.Memory.Heap.Max",
  "Status.JVM.Memory.NonHeap.Used",
  "Status.JVM.Memory.NonHeap.Max",
  "Status.JVM.Memory.Metaspace.Used",
  "Status.JVM.Memory.Metaspace.Max",
  "Status.JVM.Threads.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
  "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
  "Status.Shuffle.Netty.UsedMemory",
  "Status.Shuffle.Netty.AvailableMemory",
  "Status.Shuffle.Netty.TotalMemory",
  "Status.Flink.Memory.Managed.Used",
  "Status.Flink.Memory.Managed.Total",
]

const VERTEX_METRIC_NAMES = [
  "numRecordsInPerSecond",
  "numRecordsOutPerSecond",
  "numBytesInPerSecond",
  "numBytesOutPerSecond",
  "busyTimeMsPerSecond",
  "backPressuredTimeMsPerSecond",
  "idleTimeMsPerSecond",
  "currentInputWatermark",
  "lastCheckpointDuration",
  "lastCheckpointSize",
  "numberOfCompletedCheckpoints",
  "numberOfFailedCheckpoints",
]

export function generateMockMetricList(
  sourceType: "jm" | "tm" | "job-vertex",
): FlinkMetricItem[] {
  const names =
    sourceType === "jm"
      ? JM_METRIC_NAMES
      : sourceType === "tm"
        ? TM_METRIC_NAMES
        : VERTEX_METRIC_NAMES
  return names.map((id) => ({ id, value: "" }))
}

/** Deterministic hash for a string — produces a consistent seed per metric name. */
function hashCode(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function generateMockMetricValues(
  metricIds: string[],
): FlinkMetricItem[] {
  const now = Date.now()
  return metricIds.map((id) => {
    const seed = hashCode(id)
    // Each metric gets a unique base, amplitude, and period
    const base = (seed % 900) + 100 // 100–999
    const amplitude = (seed % 50) + 10 // 10–59
    const period = ((seed % 7) + 3) * 1000 // 3s–9s
    const phase = (seed % 628) / 100 // 0–6.28
    const value =
      base +
      amplitude * Math.sin((now / period) * Math.PI * 2 + phase) +
      (Math.random() - 0.5) * amplitude * 0.3
    return { id, value: String(Math.max(0, Math.round(value))) }
  })
}
