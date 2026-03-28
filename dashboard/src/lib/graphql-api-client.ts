/**
 * GraphQL API client — replaces flink-api-client.ts.
 *
 * Provides the same function signatures as the REST-based client but fetches
 * data via GraphQL from the Go backend. Converts GraphQL response types to
 * the domain types in cluster-types.ts.
 */
import { gql } from "urql"
import type {
  AllocatedSlot,
  Checkpoint,
  CheckpointConfig,
  CheckpointCounts,
  CheckpointLatest,
  ClusterOverview,
  ConnectorMetrics,
  ConnectorRole,
  ConnectorType,
  FlinkFeatureFlags,
  FlinkJob,
  JobConnector,
  JobEdge,
  JobException,
  JobManagerConfig,
  JobManagerInfo,
  JobManagerMetrics,
  JobPlan,
  JobVertex,
  JobVertexMetrics,
  JobVertexStatus,
  ShipStrategy,
  SubtaskBackPressure,
  SubtaskMetrics,
  TaskCounts,
  TaskManager,
  TaskManagerMemoryConfiguration,
  TaskManagerMetrics,
  TaskManagerResource,
  UploadedJar,
  UserAccumulator,
  VertexBackPressure,
  VertexWatermark,
} from "@flink-reactor/ui"
import { graphqlClient } from "./graphql-client"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseI64(s: string): number {
  return Number.parseInt(s, 10) || 0
}

function epochToDate(s: string): Date {
  const ms = parseI64(s)
  return new Date(ms)
}

function epochToDateOrNull(s: string): Date | null {
  const ms = parseI64(s)
  return ms <= 0 ? null : new Date(ms)
}

/** Collapse Flink's 10 task states → 5 domain states */
function collapseTaskCounts(raw: {
  created: number
  scheduled: number
  deploying: number
  running: number
  finished: number
  canceling: number
  canceled: number
  failed: number
  reconciling: number
  initializing: number
}): TaskCounts {
  return {
    pending:
      raw.created +
      raw.scheduled +
      raw.deploying +
      raw.reconciling +
      raw.initializing,
    running: raw.running,
    finished: raw.finished,
    canceling: raw.canceling + raw.canceled,
    failed: raw.failed,
  }
}

/** Convert accumulated time to per-second rate */
function toRate(accumulatedMs: number, durationMs: number): number {
  const durationSec = Math.max(1, durationMs / 1000)
  return Math.round(accumulatedMs / durationSec)
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

const CLUSTER_OVERVIEW_QUERY = gql`
  query ClusterOverview($cluster: String) {
    clusters { name url status lastCheckTime version capabilities }
    jobs(cluster: $cluster) {
      id name state startTime endTime duration lastModification
      tasks {
        created scheduled deploying running finished
        canceling canceled failed reconciling initializing
      }
    }
    taskManagers(cluster: $cluster) {
      id slotsNumber freeSlots
    }
  }
`

const JOB_DETAIL_QUERY = gql`
  query JobDetail($id: ID!, $cluster: String) {
    job(id: $id, cluster: $cluster) {
      id name state startTime endTime duration now
      vertices {
        id name maxParallelism parallelism status startTime endTime duration
        tasks {
          created scheduled deploying running finished
          canceling canceled failed reconciling initializing
        }
        metrics {
          readBytes readBytesComplete writeBytes writeBytesComplete
          readRecords readRecordsComplete writeRecords writeRecordsComplete
          accumulatedBackpressured accumulatedIdle accumulatedBusy
        }
      }
      plan {
        jid name type
        nodes { id parallelism operator operatorStrategy description inputs { num id shipStrategy exchange } }
      }
      exceptions { exceptionName stacktrace timestamp taskName endpoint taskManagerId }
      checkpoints {
        counts { completed inProgress failed total restored }
        history { id status isSavepoint triggerTimestamp latestAckTimestamp stateSize endToEndDuration processedData persistedData numSubtasks numAcknowledgedSubtasks checkpointedSize }
        latest {
          completed { id status triggerTimestamp stateSize endToEndDuration processedData persistedData isSavepoint }
          failed { id status triggerTimestamp stateSize endToEndDuration processedData persistedData isSavepoint }
          savepoint { id status triggerTimestamp stateSize endToEndDuration processedData persistedData isSavepoint }
          restored { id restoreTimestamp isSavepoint externalPath }
        }
      }
      checkpointConfig {
        mode interval timeout minPause maxConcurrent
        externalizedEnabled externalizedDeleteOnCancellation unalignedCheckpoints
      }
      vertexDetails {
        id name parallelism now
        subtasks {
          subtask status attempt endpoint startTime endTime duration
          metrics {
            readBytes readBytesComplete writeBytes writeBytesComplete
            readRecords readRecordsComplete writeRecords writeRecordsComplete
            accumulatedBackpressured accumulatedIdle accumulatedBusy
          }
          taskManagerId
        }
      }
      watermarks { vertexId watermarks { id value } }
      backPressure {
        vertexId
        backPressure {
          status backpressureLevel endTimestamp
          subtasks { subtask attemptNumber backpressureLevel ratio busyRatio idleRatio }
        }
      }
      accumulators { vertexId accumulators { name type value } }
      sourcesAndSinks {
        vertexId vertexName connectorType role resource confidence detectionMethod
        metrics { recordsRead recordsWritten bytesRead bytesWritten }
      }
    }
  }
`

const TASK_MANAGERS_QUERY = gql`
  query TaskManagersList($cluster: String) {
    taskManagers(cluster: $cluster) {
      id path dataPort jmxPort timeSinceLastHeartbeat slotsNumber freeSlots
      totalResource { cpuCores taskHeapMemory taskOffHeapMemory managedMemory networkMemory }
      freeResource { cpuCores taskHeapMemory taskOffHeapMemory managedMemory networkMemory }
      hardware { cpuCores physicalMemory freeMemory managedMemory }
      memoryConfiguration {
        frameworkHeap taskHeap frameworkOffHeap taskOffHeap
        networkMemory managedMemory jvmMetaspace jvmOverhead
        totalFlinkMemory totalProcessMemory
      }
    }
  }
`

const TM_DETAIL_QUERY = gql`
  query TaskManagerDetail($id: ID!, $cluster: String) {
    taskManager(id: $id, cluster: $cluster) {
      id path dataPort jmxPort timeSinceLastHeartbeat slotsNumber freeSlots
      totalResource { cpuCores taskHeapMemory taskOffHeapMemory managedMemory networkMemory }
      freeResource { cpuCores taskHeapMemory taskOffHeapMemory managedMemory networkMemory }
      hardware { cpuCores physicalMemory freeMemory managedMemory }
      memoryConfiguration {
        frameworkHeap taskHeap frameworkOffHeap taskOffHeap
        networkMemory managedMemory jvmMetaspace jvmOverhead
        totalFlinkMemory totalProcessMemory
      }
      allocatedSlots { index jobId resource { cpuCores taskHeapMemory taskOffHeapMemory managedMemory networkMemory } }
      metrics { id value }
    }
  }
`

const JOB_MANAGER_QUERY = gql`
  query JobManagerDetail($cluster: String) {
    jobManager(cluster: $cluster) {
      config { key value }
      environment { jvm { version arch options } classpath }
      metrics { id value }
    }
  }
`

const FLINK_CONFIG_QUERY = gql`
  query FlinkConfig($cluster: String) {
    flinkConfig(cluster: $cluster) {
      refreshInterval timezoneName timezoneOffset flinkVersion flinkRevision
      features { webSubmit webCancel webRescale webHistory }
    }
  }
`

const JARS_QUERY = gql`
  query JarsList($cluster: String) {
    jars(cluster: $cluster) { id name uploaded entry { name description } }
  }
`

const CANCEL_JOB_MUTATION = gql`
  mutation CancelJob($id: ID!, $cluster: String) {
    cancelJob(id: $id, cluster: $cluster) { success }
  }
`

const TRIGGER_SAVEPOINT_MUTATION = gql`
  mutation TriggerSavepoint($jobId: ID!, $targetDirectory: String, $cluster: String) {
    triggerSavepoint(jobId: $jobId, targetDirectory: $targetDirectory, cluster: $cluster) { requestId }
  }
`

const STOP_JOB_WITH_SAVEPOINT_MUTATION = gql`
  mutation StopJobWithSavepoint($jobId: ID!, $targetDirectory: String, $cluster: String) {
    stopJobWithSavepoint(jobId: $jobId, targetDirectory: $targetDirectory, cluster: $cluster) { requestId }
  }
`

const RESCALE_JOB_MUTATION = gql`
  mutation RescaleJob($jobId: ID!, $newParallelism: Int!, $cluster: String) {
    rescaleJob(jobId: $jobId, newParallelism: $newParallelism, cluster: $cluster) { requestId }
  }
`

const DELETE_JAR_MUTATION = gql`
  mutation DeleteJar($id: ID!, $cluster: String) {
    deleteJar(id: $id, cluster: $cluster) { success }
  }
`

const RUN_JAR_MUTATION = gql`
  mutation RunJar($id: ID!, $entryClass: String, $programArgs: String, $parallelism: Int, $savepointPath: String, $allowNonRestoredState: Boolean, $cluster: String) {
    runJar(id: $id, entryClass: $entryClass, programArgs: $programArgs, parallelism: $parallelism, savepointPath: $savepointPath, allowNonRestoredState: $allowNonRestoredState, cluster: $cluster) { jobId }
  }
`

const DASHBOARD_CONFIG_QUERY = gql`
  query DashboardConfig {
    dashboardConfig { clusters instruments }
  }
`

const TAP_MANIFESTS_QUERY = gql`
  query TapManifests {
    tapManifests { name description version config }
  }
`

// ---------------------------------------------------------------------------
// SQL Gateway mutations
// ---------------------------------------------------------------------------

const CREATE_SQL_SESSION = gql`
  mutation CreateSQLSession($cluster: String) {
    createSQLSession(cluster: $cluster) { sessionHandle }
  }
`

const SUBMIT_STATEMENT = gql`
  mutation SubmitStatement($sessionHandle: String!, $statement: String!, $cluster: String) {
    submitStatement(sessionHandle: $sessionHandle, statement: $statement, cluster: $cluster) { operationHandle }
  }
`

const FETCH_SQL_RESULTS = gql`
  mutation FetchSQLResults($sessionHandle: String!, $operationHandle: String!, $token: String, $cluster: String) {
    fetchSQLResults(sessionHandle: $sessionHandle, operationHandle: $operationHandle, token: $token, cluster: $cluster) {
      columns { name dataType }
      rows
      hasMore
      nextToken
    }
  }
`

const EXPLAIN_STATEMENT = gql`
  mutation ExplainStatement($sessionHandle: String!, $statement: String!, $cluster: String) {
    explainStatement(sessionHandle: $sessionHandle, statement: $statement, cluster: $cluster) {
      planText
      format
    }
  }
`

const CLOSE_SQL_SESSION = gql`
  mutation CloseSQLSession($sessionHandle: String!, $cluster: String) {
    closeSQLSession(sessionHandle: $sessionHandle, cluster: $cluster) { success }
  }
`

const JOB_HISTORY_QUERY = gql`
  query JobHistory($filter: JobHistoryFilter, $pagination: PaginationInput, $orderBy: OrderByInput) {
    jobHistory(filter: $filter, pagination: $pagination, orderBy: $orderBy) {
      edges {
        node {
          jid
          cluster
          name
          state
          startTime
          endTime
          durationMs
          tasksTotal
          tasksRunning
          tasksFinished
          tasksCanceled
          tasksFailed
          capturedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
`

// ---------------------------------------------------------------------------
// Query execution helper
// ---------------------------------------------------------------------------

async function query<T>(
  q: any,
  variables?: Record<string, unknown>,
  requestPolicy?: import("urql").RequestPolicy,
): Promise<T> {
  const result = await graphqlClient
    .query(q, variables ?? {}, requestPolicy ? { requestPolicy } : undefined)
    .toPromise()
  if (result.error) {
    throw new Error(result.error.message)
  }
  return result.data as T
}

async function mutate<T>(
  m: any,
  variables?: Record<string, unknown>,
): Promise<T> {
  const result = await graphqlClient.mutation(m, variables ?? {}).toPromise()
  if (result.error) {
    throw new Error(result.error.message)
  }
  return result.data as T
}

// ---------------------------------------------------------------------------
// Mappers: GraphQL → Domain
// ---------------------------------------------------------------------------

function mapJobOverview(j: any): FlinkJob {
  return {
    id: j.id,
    name: j.name,
    status: j.state,
    startTime: epochToDate(j.startTime),
    endTime: epochToDateOrNull(j.endTime),
    duration: parseI64(j.duration),
    tasks: collapseTaskCounts(j.tasks),
    parallelism:
      j.tasks.running + j.tasks.created + j.tasks.scheduled + j.tasks.deploying,
    plan: null,
    exceptions: [],
    checkpoints: [],
    checkpointCounts: null,
    checkpointConfig: null,
    checkpointLatest: null,
    subtaskMetrics: {},
    configuration: [],
    watermarks: {},
    backpressure: {},
    accumulators: {},
    sourcesAndSinks: [],
  }
}

function mapResource(r: any): TaskManagerResource {
  return {
    cpuCores: r.cpuCores,
    taskHeapMemory: parseI64(r.taskHeapMemory),
    taskOffHeapMemory: parseI64(r.taskOffHeapMemory),
    managedMemory: parseI64(r.managedMemory),
    networkMemory: parseI64(r.networkMemory),
  }
}

function mapMemoryConfig(m: any): TaskManagerMemoryConfiguration {
  return {
    frameworkHeap: parseI64(m.frameworkHeap),
    taskHeap: parseI64(m.taskHeap),
    frameworkOffHeap: parseI64(m.frameworkOffHeap),
    taskOffHeap: parseI64(m.taskOffHeap),
    networkMemory: parseI64(m.networkMemory),
    managedMemory: parseI64(m.managedMemory),
    jvmMetaspace: parseI64(m.jvmMetaspace),
    jvmOverhead: parseI64(m.jvmOverhead),
    totalFlinkMemory: parseI64(m.totalFlinkMemory),
    totalProcessMemory: parseI64(m.totalProcessMemory),
  }
}

const emptyTMMetrics: TaskManagerMetrics = {
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
}

/** Parse metric entries from GraphQL into a key-value map */
function parseMetrics(
  metrics: Array<{ id: string; value: string }>,
): Record<string, number> {
  const m: Record<string, number> = {}
  for (const { id, value } of metrics) {
    m[id] = Number.parseFloat(value) || 0
  }
  return m
}

/** Convert raw metric key-value pairs to TaskManagerMetrics */
function metricsToTMMetrics(raw: Record<string, number>): TaskManagerMetrics {
  return {
    cpuUsage: raw["Status.JVM.CPU.Load"] ?? 0,
    heapUsed: raw["Status.JVM.Memory.Heap.Used"] ?? 0,
    heapCommitted: raw["Status.JVM.Memory.Heap.Committed"] ?? 0,
    heapMax: raw["Status.JVM.Memory.Heap.Max"] ?? 0,
    nonHeapUsed: raw["Status.JVM.Memory.NonHeap.Used"] ?? 0,
    nonHeapCommitted: raw["Status.JVM.Memory.NonHeap.Committed"] ?? 0,
    nonHeapMax: raw["Status.JVM.Memory.NonHeap.Max"] ?? 0,
    directCount: raw["Status.JVM.Memory.Direct.Count"] ?? 0,
    directUsed: raw["Status.JVM.Memory.Direct.MemoryUsed"] ?? 0,
    directMax: raw["Status.JVM.Memory.Direct.TotalCapacity"] ?? 0,
    mappedCount: raw["Status.JVM.Memory.Mapped.Count"] ?? 0,
    mappedUsed: raw["Status.JVM.Memory.Mapped.MemoryUsed"] ?? 0,
    mappedMax: raw["Status.JVM.Memory.Mapped.TotalCapacity"] ?? 0,
    nettyShuffleMemoryAvailable:
      raw["Status.Shuffle.Netty.AvailableMemory"] ?? 0,
    nettyShuffleMemoryUsed: raw["Status.Shuffle.Netty.UsedMemory"] ?? 0,
    nettyShuffleMemoryTotal: raw["Status.Shuffle.Netty.TotalMemory"] ?? 0,
    nettyShuffleSegmentsAvailable:
      raw["Status.Shuffle.Netty.AvailableMemorySegments"] ?? 0,
    nettyShuffleSegmentsUsed:
      raw["Status.Shuffle.Netty.UsedMemorySegments"] ?? 0,
    nettyShuffleSegmentsTotal:
      raw["Status.Shuffle.Netty.TotalMemorySegments"] ?? 0,
    managedMemoryUsed: raw["Status.Flink.Memory.Managed.Used"] ?? 0,
    managedMemoryTotal: raw["Status.Flink.Memory.Managed.Total"] ?? 0,
    metaspaceUsed: raw["Status.JVM.Memory.Metaspace.Used"] ?? 0,
    metaspaceMax: raw["Status.JVM.Memory.Metaspace.Max"] ?? 0,
    garbageCollectors: [],
    threadCount: raw["Status.JVM.Threads.Count"] ?? 0,
  }
}

function mapTMOverview(tm: any): TaskManager {
  return {
    id: tm.id,
    path: tm.path,
    dataPort: tm.dataPort,
    jmxPort: tm.jmxPort,
    lastHeartbeat: new Date(parseI64(tm.timeSinceLastHeartbeat)),
    slotsTotal: tm.slotsNumber,
    slotsFree: tm.freeSlots,
    cpuCores: tm.hardware.cpuCores,
    physicalMemory: parseI64(tm.hardware.physicalMemory),
    freeMemory: parseI64(tm.hardware.freeMemory),
    totalResource: mapResource(tm.totalResource),
    freeResource: mapResource(tm.freeResource),
    memoryConfiguration: mapMemoryConfig(tm.memoryConfiguration),
    allocatedSlots: [],
    metrics: emptyTMMetrics,
    logs: "",
    stdout: "",
    logFiles: [],
    threadDump: { threadInfos: [] },
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetch cluster overview + jobs in a single query */
export async function fetchOverviewPageData(): Promise<{
  overview: ClusterOverview
  runningJobs: FlinkJob[]
  completedJobs: FlinkJob[]
}> {
  const data = await query<any>(CLUSTER_OVERVIEW_QUERY, {}, "network-only")

  const tms: any[] = data.taskManagers ?? []
  const overview: ClusterOverview = {
    flinkVersion: data.clusters?.[0]?.version ?? "unknown",
    flinkCommitId: "",
    totalTaskSlots: tms.reduce(
      (sum: number, tm: any) => sum + (tm.slotsNumber ?? 0),
      0,
    ),
    availableTaskSlots: tms.reduce(
      (sum: number, tm: any) => sum + (tm.freeSlots ?? 0),
      0,
    ),
    runningJobs: 0,
    finishedJobs: 0,
    cancelledJobs: 0,
    failedJobs: 0,
    taskManagerCount: tms.length,
    capabilities: data.clusters?.[0]?.capabilities ?? [],
  }

  const allJobs: FlinkJob[] = (data.jobs ?? []).map((j: any) =>
    mapJobOverview(j),
  )

  const runningStates = new Set([
    "RUNNING",
    "CREATED",
    "RESTARTING",
    "RECONCILING",
  ])
  const runningJobs = allJobs.filter((j) => runningStates.has(j.status))
  const completedJobs = allJobs.filter((j) => !runningStates.has(j.status))

  // Fill overview counts from the data we already have.
  overview.runningJobs = runningJobs.length
  overview.finishedJobs = completedJobs.filter(
    (j) => j.status === "FINISHED",
  ).length
  overview.cancelledJobs = completedJobs.filter(
    (j) => j.status === "CANCELED",
  ).length
  overview.failedJobs = completedJobs.filter(
    (j) => j.status === "FAILED",
  ).length

  return { overview, runningJobs, completedJobs }
}

/** Fetch task manager list */
export async function fetchTaskManagers(): Promise<TaskManager[]> {
  const data = await query<any>(TASK_MANAGERS_QUERY, {}, "network-only")
  return (data.taskManagers ?? []).map((tm: any) => mapTMOverview(tm))
}

/** Fetch task manager detail with metrics */
export async function fetchTaskManagerDetail(
  tmId: string,
): Promise<TaskManager> {
  const data = await query<any>(TM_DETAIL_QUERY, { id: tmId })
  const tm = data.taskManager
  const base = mapTMOverview(tm)
  return {
    ...base,
    allocatedSlots: (tm.allocatedSlots ?? []).map(
      (s: any): AllocatedSlot => ({
        index: s.index,
        jobId: s.jobId,
        resource: mapResource(s.resource),
      }),
    ),
    metrics: metricsToTMMetrics(parseMetrics(tm.metrics ?? [])),
  }
}

/** Fetch job manager detail */
export async function fetchJobManagerDetail(): Promise<JobManagerInfo> {
  const data = await query<any>(JOB_MANAGER_QUERY, {})
  const jm = data.jobManager
  const rawMetrics = parseMetrics(jm.metrics ?? [])

  const metrics: JobManagerMetrics = {
    jvmHeapUsed: [
      {
        timestamp: new Date(),
        value: rawMetrics["Status.JVM.Memory.Heap.Used"] ?? 0,
      },
    ],
    jvmHeapMax: rawMetrics["Status.JVM.Memory.Heap.Max"] ?? 0,
    jvmNonHeapUsed: [
      {
        timestamp: new Date(),
        value: rawMetrics["Status.JVM.Memory.NonHeap.Used"] ?? 0,
      },
    ],
    jvmNonHeapMax: rawMetrics["Status.JVM.Memory.NonHeap.Max"] ?? 0,
    threadCount: [
      {
        timestamp: new Date(),
        value: rawMetrics["Status.JVM.Threads.Count"] ?? 0,
      },
    ],
    gcCount: [],
    gcTime: [],
  }

  return {
    config: (jm.config ?? []).map(
      (c: any): JobManagerConfig => ({ key: c.key, value: c.value }),
    ),
    metrics,
    logs: "",
    stdout: "",
    jvm: {
      arguments: jm.environment?.jvm?.options ?? [],
      systemProperties: [],
      memoryConfig: {
        heapMax: rawMetrics["Status.JVM.Memory.Heap.Max"] ?? 0,
        heapUsed: rawMetrics["Status.JVM.Memory.Heap.Used"] ?? 0,
        nonHeapMax: rawMetrics["Status.JVM.Memory.NonHeap.Max"] ?? 0,
        nonHeapUsed: rawMetrics["Status.JVM.Memory.NonHeap.Used"] ?? 0,
        metaspaceMax: rawMetrics["Status.JVM.Memory.Metaspace.Max"] ?? 0,
        metaspaceUsed: rawMetrics["Status.JVM.Memory.Metaspace.Used"] ?? 0,
        directMax: rawMetrics["Status.JVM.Memory.Direct.TotalCapacity"] ?? 0,
        directUsed: rawMetrics["Status.JVM.Memory.Direct.MemoryUsed"] ?? 0,
      },
    },
    classpath: (jm.environment?.classpath ?? []).map(
      (p: string, i: number) => ({
        path: p,
        filename: p.split("/").pop() ?? p,
        size: 0,
        tag: i === 0 ? "system" : "user",
      }),
    ),
    logFiles: [],
    threadDump: { threadInfos: [] },
  }
}

/** Fetch Flink cluster configuration (feature flags) */
export async function fetchClusterConfig(): Promise<FlinkFeatureFlags> {
  const data = await query<any>(FLINK_CONFIG_QUERY, {})
  const cfg = data.flinkConfig
  return {
    webSubmit: cfg.features.webSubmit,
    webCancel: cfg.features.webCancel,
    webRescale: cfg.features.webRescale,
    webHistory: cfg.features.webHistory,
    webProfiler: false,
  }
}

/** Fetch uploaded JARs */
export async function fetchJars(): Promise<UploadedJar[]> {
  const data = await query<any>(JARS_QUERY, {})
  return (data.jars ?? []).map(
    (j: any): UploadedJar => ({
      id: j.id,
      name: j.name,
      uploadTime: epochToDate(j.uploaded),
      entryClasses: (j.entry ?? []).map((e: any) => e.name),
    }),
  )
}

/** Fetch detailed job info */
export async function fetchJobDetail(jobId: string): Promise<FlinkJob> {
  const data = await query<any>(JOB_DETAIL_QUERY, { id: jobId }, "network-only")
  const j = data.job
  const durationMs = parseI64(j.duration)

  // Map vertices with rate conversion
  const vertices: JobVertex[] = (j.vertices ?? []).map((v: any) => {
    const vDuration = parseI64(v.duration)
    const metrics: JobVertexMetrics = {
      recordsIn: parseI64(v.metrics.readRecords),
      recordsOut: parseI64(v.metrics.writeRecords),
      bytesIn: parseI64(v.metrics.readBytes),
      bytesOut: parseI64(v.metrics.writeBytes),
      busyTimeMsPerSecond: toRate(
        parseI64(v.metrics.accumulatedBusy),
        vDuration,
      ),
      backPressuredTimeMsPerSecond: toRate(
        parseI64(v.metrics.accumulatedBackpressured),
        vDuration,
      ),
    }
    return {
      id: v.id,
      name: v.name,
      parallelism: v.parallelism,
      status: mapVertexStatus(v.status),
      metrics,
      tasks: collapseTaskCounts(v.tasks),
      duration: vDuration,
      startTime: parseI64(v.startTime),
    }
  })

  // Build edges from plan node inputs
  const edges: JobEdge[] = []
  for (const node of j.plan?.nodes ?? []) {
    for (const inp of node.inputs ?? []) {
      edges.push({
        source: inp.id,
        target: node.id,
        shipStrategy: mapShipStrategy(inp.shipStrategy),
      })
    }
  }

  const plan: JobPlan = { vertices, edges }

  // Map exceptions
  const exceptions: JobException[] = (j.exceptions ?? []).map((e: any) => ({
    timestamp: epochToDate(e.timestamp),
    name: e.exceptionName,
    message: e.exceptionName,
    stacktrace: e.stacktrace,
    taskName: e.taskName ?? null,
    location: e.endpoint ?? null,
  }))

  // Map checkpoints
  const checkpoints: Checkpoint[] = (j.checkpoints?.history ?? []).map(
    (cp: any) => ({
      id: parseI64(cp.id),
      status: cp.status as "COMPLETED" | "IN_PROGRESS" | "FAILED",
      triggerTimestamp: epochToDate(cp.triggerTimestamp),
      duration: parseI64(cp.endToEndDuration),
      size: parseI64(cp.stateSize),
      checkpointedSize: cp.checkpointedSize
        ? parseI64(cp.checkpointedSize)
        : undefined,
      processedData: parseI64(cp.processedData),
      isSavepoint: cp.isSavepoint,
    }),
  )

  const checkpointCounts: CheckpointCounts | null = j.checkpoints?.counts
    ? {
        completed: j.checkpoints.counts.completed,
        failed: j.checkpoints.counts.failed,
        inProgress: j.checkpoints.counts.inProgress,
        total: j.checkpoints.counts.total,
        restored: j.checkpoints.counts.restored,
      }
    : null

  // Map checkpoint config
  let checkpointConfig: CheckpointConfig | null = null
  if (j.checkpointConfig) {
    const cc = j.checkpointConfig
    checkpointConfig = {
      mode: cc.mode as "EXACTLY_ONCE" | "AT_LEAST_ONCE",
      interval: parseI64(cc.interval),
      timeout: parseI64(cc.timeout),
      minPause: parseI64(cc.minPause),
      maxConcurrent: cc.maxConcurrent,
      externalization: {
        enabled: cc.externalizedEnabled,
        deleteOnCancellation: cc.externalizedDeleteOnCancellation,
      },
      unalignedCheckpoints: cc.unalignedCheckpoints,
    }
  }

  // Map checkpoint latest
  let checkpointLatest: CheckpointLatest | null = null
  if (j.checkpoints?.latest) {
    const lat = j.checkpoints.latest
    const mapLatestCp = (cp: any): Checkpoint | null =>
      cp
        ? {
            id: parseI64(cp.id),
            status: cp.status as "COMPLETED" | "IN_PROGRESS" | "FAILED",
            triggerTimestamp: epochToDate(cp.triggerTimestamp),
            duration: parseI64(cp.endToEndDuration),
            size: parseI64(cp.stateSize),
            processedData: parseI64(cp.processedData),
            isSavepoint: cp.isSavepoint,
          }
        : null
    checkpointLatest = {
      latestCompleted: mapLatestCp(lat.completed),
      latestFailed: mapLatestCp(lat.failed),
      latestSavepoint: mapLatestCp(lat.savepoint),
      latestRestore: lat.restored
        ? {
            id: parseI64(lat.restored.id),
            restoreTimestamp: epochToDate(lat.restored.restoreTimestamp),
            isSavepoint: lat.restored.isSavepoint,
            externalPath: lat.restored.externalPath ?? undefined,
          }
        : null,
    }
  }

  // Map subtask metrics
  const subtaskMetrics: Record<string, SubtaskMetrics[]> = {}
  for (const vd of j.vertexDetails ?? []) {
    subtaskMetrics[vd.id] = (vd.subtasks ?? []).map(
      (s: any): SubtaskMetrics => {
        const sDuration = parseI64(s.duration)
        return {
          subtaskIndex: s.subtask,
          status: s.status,
          attempt: s.attempt,
          endpoint: s.endpoint,
          taskManagerId: s.taskManagerId,
          startTime: parseI64(s.startTime),
          endTime: parseI64(s.endTime),
          duration: sDuration,
          recordsIn: parseI64(s.metrics.readRecords),
          recordsOut: parseI64(s.metrics.writeRecords),
          bytesIn: parseI64(s.metrics.readBytes),
          bytesOut: parseI64(s.metrics.writeBytes),
          busyTimeMsPerSecond: toRate(
            parseI64(s.metrics.accumulatedBusy),
            sDuration,
          ),
          backPressuredTimeMsPerSecond: toRate(
            parseI64(s.metrics.accumulatedBackpressured),
            sDuration,
          ),
          idleTimeMsPerSecond: toRate(
            parseI64(s.metrics.accumulatedIdle),
            sDuration,
          ),
        }
      },
    )
  }

  // Map watermarks
  const watermarks: Record<string, VertexWatermark[]> = {}
  for (const vw of j.watermarks ?? []) {
    watermarks[vw.vertexId] = (vw.watermarks ?? []).map(
      (w: any): VertexWatermark => {
        const match = w.id.match(/^(\d+)\./)
        return {
          subtaskIndex: match ? Number.parseInt(match[1], 10) : 0,
          watermark: Number.parseInt(w.value, 10),
        }
      },
    )
  }

  // Map backpressure
  const backpressure: Record<string, VertexBackPressure> = {}
  for (const vbp of j.backPressure ?? []) {
    const bp = vbp.backPressure
    backpressure[vbp.vertexId] = {
      level: bp.backpressureLevel as "ok" | "low" | "high",
      endTimestamp: parseI64(bp.endTimestamp),
      subtasks: (bp.subtasks ?? []).map(
        (s: any): SubtaskBackPressure => ({
          subtaskIndex: s.subtask,
          level: s.backpressureLevel as "ok" | "low" | "high",
          ratio: s.ratio,
          busyRatio: s.busyRatio,
          idleRatio: s.idleRatio,
        }),
      ),
    }
  }

  // Map accumulators
  const accumulators: Record<string, UserAccumulator[]> = {}
  for (const va of j.accumulators ?? []) {
    accumulators[va.vertexId] = (va.accumulators ?? []).map(
      (a: any): UserAccumulator => ({
        name: a.name,
        type: a.type,
        value: a.value,
      }),
    )
  }

  return {
    id: j.id,
    name: j.name,
    status: j.state,
    startTime: epochToDate(j.startTime),
    endTime: epochToDateOrNull(j.endTime),
    duration: durationMs,
    tasks: vertices.reduce(
      (acc, v) => ({
        pending: acc.pending + v.tasks.pending,
        running: acc.running + v.tasks.running,
        finished: acc.finished + v.tasks.finished,
        canceling: acc.canceling + v.tasks.canceling,
        failed: acc.failed + v.tasks.failed,
      }),
      {
        pending: 0,
        running: 0,
        finished: 0,
        canceling: 0,
        failed: 0,
      } as TaskCounts,
    ),
    parallelism: Math.max(...vertices.map((v) => v.parallelism), 0),
    plan,
    exceptions,
    checkpoints,
    checkpointCounts,
    checkpointConfig,
    checkpointLatest,
    subtaskMetrics,
    configuration: [],
    watermarks,
    backpressure,
    accumulators,
    sourcesAndSinks: (j.sourcesAndSinks ?? []).map(
      (c: any): JobConnector => ({
        vertexId: c.vertexId,
        vertexName: c.vertexName,
        connectorType: c.connectorType as ConnectorType,
        role: c.role as ConnectorRole,
        resource: c.resource,
        confidence: c.confidence,
        detectionMethod: c.detectionMethod,
        metrics: c.metrics
          ? {
              recordsRead: parseI64(c.metrics.recordsRead),
              recordsWritten: parseI64(c.metrics.recordsWritten),
              bytesRead: parseI64(c.metrics.bytesRead),
              bytesWritten: parseI64(c.metrics.bytesWritten),
            }
          : null,
      }),
    ),
  }
}

/** Cancel a job */
export async function cancelJob(jobId: string): Promise<void> {
  await mutate(CANCEL_JOB_MUTATION, { id: jobId })
}

/** Trigger a savepoint for a running job */
export async function triggerSavepoint(
  jobId: string,
  targetDirectory?: string,
): Promise<string> {
  const data = await mutate<any>(TRIGGER_SAVEPOINT_MUTATION, {
    jobId,
    targetDirectory,
  })
  return data.triggerSavepoint.requestId
}

/** Stop a job with a savepoint (graceful shutdown) */
export async function stopJobWithSavepoint(
  jobId: string,
  targetDirectory?: string,
): Promise<string> {
  const data = await mutate<any>(STOP_JOB_WITH_SAVEPOINT_MUTATION, {
    jobId,
    targetDirectory,
  })
  return data.stopJobWithSavepoint.requestId
}

/** Rescale a running job to a new parallelism */
export async function rescaleJob(
  jobId: string,
  newParallelism: number,
): Promise<string> {
  const data = await mutate<any>(RESCALE_JOB_MUTATION, {
    jobId,
    newParallelism,
  })
  return data.rescaleJob.requestId
}

/** Run a JAR */
export async function runJar(
  jarId: string,
  opts: {
    entryClass?: string
    parallelism?: number
    programArgs?: string
    savepointPath?: string | null
    allowNonRestoredState?: boolean
  },
): Promise<void> {
  await mutate(RUN_JAR_MUTATION, {
    id: jarId,
    entryClass: opts.entryClass,
    programArgs: opts.programArgs,
    parallelism: opts.parallelism,
    savepointPath: opts.savepointPath,
    allowNonRestoredState: opts.allowNonRestoredState,
  })
}

/** Upload a JAR — still uses REST since GraphQL doesn't support file uploads */
export async function uploadJar(file: File): Promise<UploadedJar[]> {
  // JAR upload requires multipart form data which isn't practical via GraphQL.
  // We'll use a direct POST to the Go server's upload endpoint.
  const formData = new FormData()
  formData.append("jarfile", file)

  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/jars/upload`, {
    method: "POST",
    body: formData,
  })
  if (!resp.ok) {
    throw new Error(`JAR upload failed: ${resp.statusText}`)
  }

  // Re-fetch the JAR list after upload.
  return fetchJars()
}

/** Delete a JAR */
export async function deleteJar(jarId: string): Promise<void> {
  await mutate(DELETE_JAR_MUTATION, { id: jarId })
}

/** Fetch dashboard config */
export async function fetchDashboardConfig(): Promise<{
  clusters: string[]
  instruments: string[]
}> {
  const data = await query<any>(DASHBOARD_CONFIG_QUERY, {})
  return data.dashboardConfig
}

/** Fetch tap manifests */
export async function fetchTapManifests(): Promise<
  Array<{
    name: string
    description: string
    version: string
    config: Record<string, unknown>
  }>
> {
  const data = await query<any>(TAP_MANIFESTS_QUERY, {})
  return data.tapManifests ?? []
}

// ---------------------------------------------------------------------------
// SQL Gateway operations
// ---------------------------------------------------------------------------

export async function createSQLSession(): Promise<string> {
  const data = await mutate<any>(CREATE_SQL_SESSION, {})
  return data.createSQLSession.sessionHandle
}

export async function submitSQLStatement(
  sessionHandle: string,
  statement: string,
): Promise<string> {
  const data = await mutate<any>(SUBMIT_STATEMENT, { sessionHandle, statement })
  return data.submitStatement.operationHandle
}

export async function explainStatement(
  sessionHandle: string,
  statement: string,
): Promise<{ planText: string; format: string }> {
  const data = await mutate<any>(EXPLAIN_STATEMENT, {
    sessionHandle,
    statement,
  })
  return data.explainStatement
}

export async function fetchSQLResults(
  sessionHandle: string,
  operationHandle: string,
  token?: string,
): Promise<{
  columns: Array<{ name: string; dataType: string }>
  rows: Array<Array<string | null>>
  hasMore: boolean
  nextToken: string | null
}> {
  const data = await mutate<any>(FETCH_SQL_RESULTS, {
    sessionHandle,
    operationHandle,
    token,
  })
  return data.fetchSQLResults
}

export async function closeSQLSession(sessionHandle: string): Promise<void> {
  await mutate(CLOSE_SQL_SESSION, { sessionHandle })
}

// ---------------------------------------------------------------------------
// Helpers for vertex status / ship strategy mapping
// ---------------------------------------------------------------------------

function mapVertexStatus(status: string): JobVertexStatus {
  switch (status) {
    case "RUNNING":
      return "RUNNING"
    case "FINISHED":
      return "FINISHED"
    case "FAILED":
      return "FAILED"
    case "CANCELING":
    case "CANCELED":
      return "CANCELED"
    default:
      return "CREATED"
  }
}

function mapShipStrategy(strategy: string): ShipStrategy {
  switch (strategy) {
    case "HASH":
      return "HASH"
    case "REBALANCE":
      return "REBALANCE"
    case "BROADCAST":
      return "BROADCAST"
    case "RESCALE":
      return "RESCALE"
    case "GLOBAL":
      return "GLOBAL"
    default:
      return "FORWARD"
  }
}

// ---------------------------------------------------------------------------
// Log fetching — uses plain HTTP, not GraphQL
// ---------------------------------------------------------------------------

export async function fetchTaskManagerLog(tmId: string): Promise<string> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/logs/taskmanagers/${tmId}`)
  if (!resp.ok) throw new Error(`Failed to fetch TM log: ${resp.statusText}`)
  return resp.text()
}

export async function fetchJobManagerLog(): Promise<string> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/logs/jobmanager`)
  if (!resp.ok) throw new Error(`Failed to fetch JM log: ${resp.statusText}`)
  return resp.text()
}

export async function fetchSQLGatewayLog(): Promise<string> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/logs/sql-gateway`)
  if (!resp.ok)
    throw new Error(`Failed to fetch SQL Gateway log: ${resp.statusText}`)
  return resp.text()
}

// ---------------------------------------------------------------------------
// Metrics — plain REST proxy (Flink metrics API doesn't map well to GraphQL)
// ---------------------------------------------------------------------------

/** Fetch list of available metric names from a Flink metrics endpoint. */
export async function fetchMetricList(proxyUrl: string): Promise<string[]> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}${proxyUrl}`)
  if (!resp.ok) throw new Error(`Metric list fetch failed: ${resp.statusText}`)
  const raw: Array<{ id: string }> = await resp.json()
  return raw.map((item) => item.id)
}

/** Fetch metric values by name from a Flink metrics endpoint. */
export async function fetchMetricValues(
  proxyUrl: string,
  metricIds: string[],
): Promise<Record<string, number>> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const separator = proxyUrl.includes("?") ? "&" : "?"
  const resp = await fetch(
    `${baseUrl}${proxyUrl}${separator}get=${metricIds.join(",")}`,
  )
  if (!resp.ok)
    throw new Error(`Metric values fetch failed: ${resp.statusText}`)
  const raw: Array<{ id: string; value: string }> = await resp.json()
  const result: Record<string, number> = {}
  for (const item of raw) {
    const parsed = Number.parseFloat(item.value)
    if (!Number.isNaN(parsed)) {
      result[item.id] = parsed
    }
  }
  return result
}

// ---------------------------------------------------------------------------
// Additional REST endpoints — used by components for features not in GraphQL
// ---------------------------------------------------------------------------

/** Fetch TM metrics — returns TaskManagerMetrics-compatible shape. */
export async function fetchTaskManagerMetrics(
  tmId: string,
): Promise<TaskManagerMetrics> {
  const raw = await fetchMetricValues(
    `/api/flink/taskmanagers/${tmId}/metrics`,
    [
      "Status.JVM.CPU.Load",
      "Status.JVM.Memory.Heap.Used",
      "Status.JVM.Memory.Heap.Committed",
      "Status.JVM.Memory.Heap.Max",
      "Status.JVM.Memory.NonHeap.Used",
      "Status.JVM.Memory.NonHeap.Committed",
      "Status.JVM.Memory.NonHeap.Max",
      "Status.JVM.Memory.Direct.Count",
      "Status.JVM.Memory.Direct.MemoryUsed",
      "Status.JVM.Memory.Direct.TotalCapacity",
      "Status.JVM.Memory.Mapped.Count",
      "Status.JVM.Memory.Mapped.MemoryUsed",
      "Status.JVM.Memory.Mapped.TotalCapacity",
      "Status.JVM.Threads.Count",
      "Status.Shuffle.Netty.UsedMemory",
      "Status.Shuffle.Netty.AvailableMemory",
      "Status.Shuffle.Netty.TotalMemory",
      "Status.Shuffle.Netty.UsedMemorySegments",
      "Status.Shuffle.Netty.AvailableMemorySegments",
      "Status.Shuffle.Netty.TotalMemorySegments",
      "Status.Flink.Memory.Managed.Used",
      "Status.Flink.Memory.Managed.Total",
      "Status.JVM.Memory.Metaspace.Used",
      "Status.JVM.Memory.Metaspace.Max",
      "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
      "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
      "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
      "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
    ],
  )
  return metricsToTMMetrics(raw)
}

/** Fetch JM metrics — returns flat object with named fields. */
export async function fetchJobManagerMetrics(): Promise<{
  heapUsed: number
  heapMax: number
  nonHeapUsed: number
  nonHeapMax: number
  threadCount: number
  gcCount: number
  gcTime: number
}> {
  const raw = await fetchMetricValues("/api/flink/jobmanager/metrics", [
    "Status.JVM.Memory.Heap.Used",
    "Status.JVM.Memory.Heap.Max",
    "Status.JVM.Memory.NonHeap.Used",
    "Status.JVM.Memory.NonHeap.Max",
    "Status.JVM.Threads.Count",
    "Status.JVM.GarbageCollector.G1_Young_Generation.Count",
    "Status.JVM.GarbageCollector.G1_Young_Generation.Time",
    "Status.JVM.GarbageCollector.G1_Old_Generation.Count",
    "Status.JVM.GarbageCollector.G1_Old_Generation.Time",
  ])
  return {
    heapUsed: raw["Status.JVM.Memory.Heap.Used"] ?? 0,
    heapMax: raw["Status.JVM.Memory.Heap.Max"] ?? 0,
    nonHeapUsed: raw["Status.JVM.Memory.NonHeap.Used"] ?? 0,
    nonHeapMax: raw["Status.JVM.Memory.NonHeap.Max"] ?? 0,
    threadCount: raw["Status.JVM.Threads.Count"] ?? 0,
    gcCount:
      (raw["Status.JVM.GarbageCollector.G1_Young_Generation.Count"] ?? 0) +
      (raw["Status.JVM.GarbageCollector.G1_Old_Generation.Count"] ?? 0),
    gcTime:
      (raw["Status.JVM.GarbageCollector.G1_Young_Generation.Time"] ?? 0) +
      (raw["Status.JVM.GarbageCollector.G1_Old_Generation.Time"] ?? 0),
  }
}

/** Fetch TM log file list. */
export async function fetchTaskManagerLogs(
  tmId: string,
): Promise<Array<{ name: string; lastModified: Date; size: number }>> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/logs/taskmanagers/${tmId}/logs`)
  if (!resp.ok) return []
  const raw: Array<{ name: string; size: number; lastModified?: string }> =
    await resp.json()
  return raw.map((f) => ({
    name: f.name,
    size: f.size,
    lastModified: f.lastModified ? new Date(f.lastModified) : new Date(),
  }))
}

/** Fetch a specific TM log file by name. */
export async function fetchTaskManagerLogFile(
  tmId: string,
  logName: string,
): Promise<string> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(
    `${baseUrl}/api/logs/taskmanagers/${tmId}/logs/${logName}`,
  )
  if (!resp.ok)
    throw new Error(`Failed to fetch TM log file: ${resp.statusText}`)
  return resp.text()
}

/** Fetch TM stdout. */
export async function fetchTaskManagerStdout(tmId: string): Promise<string> {
  return fetchTaskManagerLogFile(tmId, "taskmanager.out")
}

/** Fetch TM thread dump. */
export async function fetchTaskManagerThreadDump(tmId: string): Promise<{
  threadInfos: Array<{ threadName: string; stringifiedThreadInfo: string }>
}> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(
    `${baseUrl}/api/flink/taskmanagers/${tmId}/thread-dump`,
  )
  if (!resp.ok) return { threadInfos: [] }
  return resp.json()
}

/** Fetch JM log file list. */
export async function fetchJobManagerLogs(): Promise<
  Array<{ name: string; lastModified: Date; size: number }>
> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/logs/jobmanager/logs`)
  if (!resp.ok) return []
  const raw: Array<{ name: string; size: number; lastModified?: string }> =
    await resp.json()
  return raw.map((f) => ({
    name: f.name,
    size: f.size,
    lastModified: f.lastModified ? new Date(f.lastModified) : new Date(),
  }))
}

/** Fetch a specific JM log file by name. */
export async function fetchJobManagerLogFile(logName: string): Promise<string> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/logs/jobmanager/logs/${logName}`)
  if (!resp.ok)
    throw new Error(`Failed to fetch JM log file: ${resp.statusText}`)
  return resp.text()
}

/** Fetch JM stdout. */
export async function fetchJobManagerStdout(): Promise<string> {
  return fetchJobManagerLogFile("jobmanager.out")
}

/** Fetch JM thread dump. */
export async function fetchJobManagerThreadDump(): Promise<{
  threadInfos: Array<{ threadName: string; stringifiedThreadInfo: string }>
}> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(`${baseUrl}/api/flink/jobmanager/thread-dump`)
  if (!resp.ok) return { threadInfos: [] }
  return resp.json()
}

/** Fetch checkpoint detail. */
export async function fetchCheckpointDetail(
  jobId: string,
  checkpointId: number,
): Promise<any> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(
    `${baseUrl}/api/flink/jobs/${jobId}/checkpoints/${checkpointId}/detail`,
  )
  if (!resp.ok)
    throw new Error(`Failed to fetch checkpoint detail: ${resp.statusText}`)
  return resp.json()
}

/** Fetch checkpoint subtask detail. */
export async function fetchCheckpointSubtaskDetail(
  jobId: string,
  checkpointId: number,
  vertexId: string,
): Promise<any> {
  const baseUrl = (import.meta.env.VITE_GRAPHQL_URL ?? "").replace(
    "/graphql",
    "",
  )
  const resp = await fetch(
    `${baseUrl}/api/flink/jobs/${jobId}/checkpoints/${checkpointId}/subtasks/${vertexId}`,
  )
  if (!resp.ok)
    throw new Error(`Failed to fetch subtask detail: ${resp.statusText}`)
  return resp.json()
}

// ---------------------------------------------------------------------------
// Catalogs
// ---------------------------------------------------------------------------

export type CatalogInfo = {
  name: string
  source: string
  connectorType: string
  properties: Record<string, string> | null
  databaseCount: number
  tableCount: number
}
export type CatalogDatabase = { name: string }
export type CatalogTable = { name: string }
export type ColumnInfo = { name: string; type: string }

const CATALOGS_QUERY = gql`
  query Catalogs {
    catalogs {
      name
      source
      connectorType
      properties
      databaseCount
      tableCount
    }
  }
`

const CATALOG_DATABASES_QUERY = gql`
  query CatalogDatabases($catalog: String!) {
    catalogDatabases(catalog: $catalog) { name }
  }
`

const CATALOG_TABLES_QUERY = gql`
  query CatalogTables($catalog: String!, $database: String!) {
    catalogTables(catalog: $catalog, database: $database) { name }
  }
`

export async function fetchCatalogs(): Promise<CatalogInfo[]> {
  const result = await graphqlClient.query(CATALOGS_QUERY, {}).toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.catalogs ?? []
}

export async function fetchCatalogDatabases(
  catalog: string,
): Promise<CatalogDatabase[]> {
  const result = await graphqlClient
    .query(CATALOG_DATABASES_QUERY, { catalog })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.catalogDatabases ?? []
}

export async function fetchCatalogTables(
  catalog: string,
  database: string,
): Promise<CatalogTable[]> {
  const result = await graphqlClient
    .query(CATALOG_TABLES_QUERY, { catalog, database })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.catalogTables ?? []
}

const CATALOG_COLUMNS_QUERY = gql`
  query CatalogColumns($catalog: String!, $database: String!, $table: String!) {
    catalogColumns(catalog: $catalog, database: $database, table: $table) { name type }
  }
`

export async function fetchCatalogColumns(
  catalog: string,
  database: string,
  table: string,
): Promise<ColumnInfo[]> {
  const result = await graphqlClient
    .query(CATALOG_COLUMNS_QUERY, { catalog, database, table })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.catalogColumns ?? []
}

const CATALOG_TABLE_DDL_QUERY = gql`
  query CatalogTableDDL($catalog: String!, $database: String!, $table: String!) {
    catalogTableDDL(catalog: $catalog, database: $database, table: $table)
  }
`

export async function fetchCatalogTableDDL(
  catalog: string,
  database: string,
  table: string,
): Promise<string> {
  const result = await graphqlClient
    .query(CATALOG_TABLE_DDL_QUERY, { catalog, database, table })
    .toPromise()
  if (result.error) throw new Error(result.error.message)
  return result.data?.catalogTableDDL ?? ""
}

// ---------------------------------------------------------------------------
// Job History
// ---------------------------------------------------------------------------

export interface JobHistoryEntry {
  jid: string
  cluster: string
  name: string
  state: string
  startTime: string | null
  endTime: string | null
  durationMs: number
  tasksTotal: number
  tasksRunning: number
  tasksFinished: number
  tasksCanceled: number
  tasksFailed: number
  capturedAt: string
}

export interface JobHistoryPage {
  entries: JobHistoryEntry[]
  hasNextPage: boolean
  endCursor: string | null
  totalCount: number
}

export interface JobHistoryParams {
  filter?: {
    clusterID?: string
    state?: string
    name?: string
    after?: string
    before?: string
    timeRange?: string
  }
  pagination?: {
    first?: number
    after?: string
  }
  orderBy?: {
    field: string
    direction: string
  }
}

export async function fetchJobHistory(
  params: JobHistoryParams,
): Promise<JobHistoryPage> {
  const data = await query<any>(JOB_HISTORY_QUERY, params, "network-only")
  const conn = data.jobHistory
  const entries: JobHistoryEntry[] = (conn.edges ?? []).map((edge: any) => ({
    jid: edge.node.jid,
    cluster: edge.node.cluster,
    name: edge.node.name,
    state: edge.node.state,
    startTime: edge.node.startTime ?? null,
    endTime: edge.node.endTime ?? null,
    durationMs: Number.parseInt(edge.node.durationMs, 10) || 0,
    tasksTotal: edge.node.tasksTotal,
    tasksRunning: edge.node.tasksRunning,
    tasksFinished: edge.node.tasksFinished,
    tasksCanceled: edge.node.tasksCanceled,
    tasksFailed: edge.node.tasksFailed,
    capturedAt: edge.node.capturedAt,
  }))
  return {
    entries,
    hasNextPage: conn.pageInfo.hasNextPage,
    endCursor: conn.pageInfo.endCursor ?? null,
    totalCount: conn.pageInfo.totalCount,
  }
}

// ---------------------------------------------------------------------------
// Metrics Explorer — DB-backed catalog and time-series queries
// ---------------------------------------------------------------------------

export type MetricCatalogEntry = {
  sourceType: string
  sourceID: string
  metricID: string
}

export type MetricTimeSeries = {
  sourceType: string
  sourceID: string
  metricID: string
  points: Array<{ value: number; capturedAt: string }>
}

const METRIC_CATALOG_QUERY = gql`
  query MetricCatalog($clusterID: String!) {
    metricCatalog(clusterID: $clusterID) {
      sourceType
      sourceID
      metricID
    }
  }
`

const METRIC_SERIES_QUERY = gql`
  query MetricSeries(
    $clusterID: String!
    $series: [MetricSeriesRequest!]!
    $after: String!
    $before: String!
    $maxPoints: Int
  ) {
    metricSeries(
      clusterID: $clusterID
      series: $series
      after: $after
      before: $before
      maxPoints: $maxPoints
    ) {
      sourceType
      sourceID
      metricID
      points {
        value
        capturedAt
      }
    }
  }
`

/** Fetch the metric catalog (distinct metrics with recent data) for a cluster. */
export async function fetchMetricCatalog(
  clusterID: string,
): Promise<MetricCatalogEntry[]> {
  const result = await graphqlClient
    .query(METRIC_CATALOG_QUERY, { clusterID })
    .toPromise()
  if (result.error) throw result.error
  return (result.data?.metricCatalog ?? []) as MetricCatalogEntry[]
}

/** Fetch multiple metric time series in a single batch query. */
export async function fetchMetricSeries(params: {
  clusterID: string
  series: Array<{ sourceType: string; sourceID: string; metricID: string }>
  after: string
  before: string
  maxPoints?: number
}): Promise<MetricTimeSeries[]> {
  const result = await graphqlClient
    .query(METRIC_SERIES_QUERY, {
      clusterID: params.clusterID,
      series: params.series,
      after: params.after,
      before: params.before,
      maxPoints: params.maxPoints ?? 500,
    })
    .toPromise()
  if (result.error) throw result.error
  return (result.data?.metricSeries ?? []) as MetricTimeSeries[]
}

// ---------------------------------------------------------------------------
// Simulations
// ---------------------------------------------------------------------------

export type SimulationStatus =
  | "PENDING"
  | "RUNNING"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED"

export type SimulationObservation = {
  timestamp: string
  metric: string
  value: number
  annotation: string | null
}

export type SimulationRun = {
  id: string
  scenario: string
  status: SimulationStatus
  startedAt: string
  stoppedAt: string | null
  parameters: Record<string, unknown>
  observations: SimulationObservation[]
}

export type SimulationPreset = {
  name: string
  description: string
  scenario: string
  defaultParameters: Record<string, unknown>
  category: string
}

export type SimulationInputParams = {
  scenario: string
  targetJobs?: string[]
  parameters: Record<string, unknown>
  cluster?: string
}

const SIMULATION_PREFLIGHT_QUERY = gql`
  query SimulationPreflight {
    simulationPreflight { id label status detail fix required }
  }
`

export type PreflightCheckResult = {
  id: string
  label: string
  status: "pass" | "fail" | "warn"
  detail: string | null
  fix: string | null
  required: boolean
}

export async function checkSimulationPreflight(): Promise<
  PreflightCheckResult[]
> {
  try {
    const data = await query<any>(
      SIMULATION_PREFLIGHT_QUERY,
      {},
      "network-only",
    )
    return (data.simulationPreflight ?? []) as PreflightCheckResult[]
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return [
      {
        id: "preflight-error",
        label: "Pre-flight check failed",
        status: "fail",
        detail: message,
        fix: null,
        required: true,
      },
    ]
  }
}

const SIMULATION_PRESETS_QUERY = gql`
  query SimulationPresets {
    simulationPresets { name description scenario defaultParameters category }
  }
`

const SIMULATION_RUNS_QUERY = gql`
  query SimulationRuns {
    simulationRuns { id scenario status startedAt stoppedAt parameters }
  }
`

const SIMULATION_RUN_QUERY = gql`
  query SimulationRun($id: ID!) {
    simulationRun(id: $id) {
      id scenario status startedAt stoppedAt parameters
      observations { timestamp metric value annotation }
    }
  }
`

const RUN_SIMULATION_MUTATION = gql`
  mutation RunSimulation($input: SimulationInput!) {
    runSimulation(input: $input) { id scenario status startedAt parameters observations { timestamp metric value annotation } }
  }
`

const STOP_SIMULATION_MUTATION = gql`
  mutation StopSimulation($runId: ID!) {
    stopSimulation(runId: $runId) { id scenario status stoppedAt }
  }
`

export async function fetchSimulationPresets(): Promise<SimulationPreset[]> {
  const data = await query<any>(SIMULATION_PRESETS_QUERY)
  return data.simulationPresets ?? []
}

export async function fetchSimulationRuns(): Promise<SimulationRun[]> {
  const data = await query<any>(SIMULATION_RUNS_QUERY, {}, "network-only")
  return data.simulationRuns ?? []
}

export async function fetchSimulationRun(
  id: string,
): Promise<SimulationRun | null> {
  const data = await query<any>(SIMULATION_RUN_QUERY, { id }, "network-only")
  return data.simulationRun ?? null
}

export async function runSimulation(
  input: SimulationInputParams,
): Promise<SimulationRun> {
  const data = await mutate<any>(RUN_SIMULATION_MUTATION, { input })
  return data.runSimulation
}

export async function stopSimulation(runId: string): Promise<SimulationRun> {
  const data = await mutate<any>(STOP_SIMULATION_MUTATION, { runId })
  return data.stopSimulation
}
