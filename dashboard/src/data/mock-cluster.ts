import type {
  Checkpoint,
  CheckpointConfig,
  CheckpointCounts,
  ClasspathEntry,
  ClusterOverview,
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
  JobVertexStatus,
  JvmInfo,
  JvmMetricSample,
  LogFileEntry,
  ShipStrategy,
  SubtaskBackPressure,
  SubtaskMetrics,
  TaskCounts,
  TaskManager,
  TaskManagerMemoryConfiguration,
  TaskManagerMetrics,
  TaskManagerResource,
  ThreadDumpEntry,
  ThreadDumpInfo,
  ThreadInfoRaw,
  UploadedJar,
  UserAccumulator,
  VertexBackPressure,
  VertexWatermark,
} from "./cluster-types"
import { PLACEHOLDER_VALUES, pickRandom, TASK_MANAGERS } from "./flink-loggers"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hex(length: number): string {
  let out = ""
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 16).toString(16)
  }
  return out
}

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000)
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000)
}

function jitter(base: number, pct: number): number {
  const delta = base * pct
  return base + (Math.random() * 2 - 1) * delta
}

const GB = 1024 ** 3
const MB = 1024 ** 2

// ---------------------------------------------------------------------------
// Module-level caches — mock data must return stable IDs across poll cycles
// so that cross-endpoint references (job ID in overview → job detail fetch)
// work correctly, just like a real Flink cluster.
// ---------------------------------------------------------------------------

let cachedRunningJobs: FlinkJob[] | null = null
let cachedCompletedJobs: FlinkJob[] | null = null
let cachedTaskManagers: TaskManager[] | null = null

// ---------------------------------------------------------------------------
// Job names (reuse PLACEHOLDER_VALUES for cross-page consistency)
// ---------------------------------------------------------------------------

const JOB_NAMES = PLACEHOLDER_VALUES.JOB_NAME

const EXTRA_JOB_NAMES = [
  "UserSessionAggregation",
  "PageViewCounter",
  "RealTimeInventorySync",
  "PaymentReconciliation",
  "LogAnomalyDetector",
  "ClickstreamEnrichment",
  "SensorDataIngestion",
  "NotificationDispatcher",
]

const ALL_JOB_NAMES = [...JOB_NAMES, ...EXTRA_JOB_NAMES]

// ---------------------------------------------------------------------------
// Task count generation
// ---------------------------------------------------------------------------

function generateTaskCounts(
  parallelism: number,
  status: JobStatus,
): TaskCounts {
  const counts: TaskCounts = {
    pending: 0,
    running: 0,
    finished: 0,
    canceling: 0,
    failed: 0,
  }

  if (status === "FINISHED") {
    counts.finished = parallelism
  } else if (status === "FAILED") {
    counts.failed = Math.ceil(parallelism * 0.25)
    counts.finished = parallelism - counts.failed
  } else if (status === "CANCELED" || status === "CANCELLING") {
    counts.canceling = Math.ceil(parallelism * 0.3)
    counts.finished = parallelism - counts.canceling
  } else if (status === "RUNNING") {
    // Mostly running with a few finished
    const finished = Math.floor(Math.random() * Math.ceil(parallelism * 0.3))
    const pending = Math.random() < 0.2 ? 1 : 0
    counts.finished = finished
    counts.pending = pending
    counts.running = parallelism - finished - pending
  } else {
    counts.pending = parallelism
  }

  return counts
}

// ---------------------------------------------------------------------------
// Job detail generators
// ---------------------------------------------------------------------------

const OPERATOR_TEMPLATES: {
  name: string
  type: "source" | "transform" | "sink"
}[] = [
  { name: "Source: KafkaSource", type: "source" },
  { name: "Source: JdbcSource", type: "source" },
  { name: "Filter", type: "transform" },
  { name: "Map", type: "transform" },
  { name: "FlatMap", type: "transform" },
  { name: "Aggregate", type: "transform" },
  { name: "KeyedProcess", type: "transform" },
  { name: "Join", type: "transform" },
  { name: "Sink: KafkaSink", type: "sink" },
  { name: "Sink: JdbcSink", type: "sink" },
  { name: "Sink: FileSystemSink", type: "sink" },
]

const SHIP_STRATEGIES: ShipStrategy[] = [
  "FORWARD",
  "HASH",
  "REBALANCE",
  "BROADCAST",
  "RESCALE",
]

function vertexStatusFromJob(jobStatus: JobStatus): JobVertexStatus {
  if (jobStatus === "RUNNING") return "RUNNING"
  if (jobStatus === "FINISHED") return "FINISHED"
  if (jobStatus === "FAILED") return "FAILED"
  if (jobStatus === "CANCELED" || jobStatus === "CANCELLING") return "CANCELED"
  return "CREATED"
}

export function generateJobPlan(
  parallelism: number,
  jobStatus: JobStatus,
  jobStartTime: Date,
): JobPlan {
  // Create a realistic 4-6 vertex DAG
  const vertexCount = 4 + Math.floor(Math.random() * 3)
  const vertices: JobVertex[] = []
  const edges: JobEdge[] = []

  // Pick operators: source(s) → transforms → sink(s)
  const sources = OPERATOR_TEMPLATES.filter((o) => o.type === "source")
  const transforms = OPERATOR_TEMPLATES.filter((o) => o.type === "transform")
  const sinks = OPERATOR_TEMPLATES.filter((o) => o.type === "sink")

  const pipeline: string[] = []
  pipeline.push(pickRandom(sources).name)
  const transformCount = Math.max(1, vertexCount - 2)
  const usedTransforms = new Set<string>()
  for (let i = 0; i < transformCount; i++) {
    let t: string
    do {
      t = pickRandom(transforms).name
    } while (usedTransforms.has(t) && usedTransforms.size < transforms.length)
    usedTransforms.add(t)
    pipeline.push(t)
  }
  pipeline.push(pickRandom(sinks).name)

  const jobStartMs = jobStartTime.getTime()
  const baseStatus = vertexStatusFromJob(jobStatus)

  for (let i = 0; i < pipeline.length; i++) {
    const id = hex(32)
    const vertexPar =
      i === 0
        ? parallelism
        : pickRandom([parallelism, parallelism, Math.max(1, parallelism / 2)])
    const baseRecords = 50_000 + Math.floor(Math.random() * 2_000_000)
    const busyTime = Math.floor(Math.random() * 900)
    const vertexStartOffset = i * (2000 + Math.floor(Math.random() * 3000))

    // For failed jobs, make the last transform vertex failed
    let vStatus = baseStatus
    if (jobStatus === "FAILED" && i === pipeline.length - 2) {
      vStatus = "FAILED"
    } else if (jobStatus === "FAILED" && i === pipeline.length - 1) {
      vStatus = "CANCELED"
    }

    vertices.push({
      id,
      name: pipeline[i],
      parallelism: vertexPar,
      status: vStatus,
      metrics: {
        recordsIn: i === 0 ? 0 : baseRecords,
        recordsOut:
          i === pipeline.length - 1
            ? 0
            : Math.floor(baseRecords * (0.7 + Math.random() * 0.3)),
        bytesIn: i === 0 ? 0 : baseRecords * 256,
        bytesOut: i === pipeline.length - 1 ? 0 : baseRecords * 200,
        busyTimeMsPerSecond: busyTime,
        backPressuredTimeMsPerSecond: Math.max(0, busyTime - 400),
      },
      tasks: generateTaskCounts(
        vertexPar,
        vStatus === "RUNNING"
          ? "RUNNING"
          : vStatus === "FINISHED"
            ? "FINISHED"
            : vStatus === "FAILED"
              ? "FAILED"
              : "CANCELED",
      ),
      duration: 10_000 + Math.floor(Math.random() * 300_000),
      startTime: jobStartMs + vertexStartOffset,
    })
  }

  // Create edges (linear chain)
  for (let i = 0; i < vertices.length - 1; i++) {
    edges.push({
      source: vertices[i].id,
      target: vertices[i + 1].id,
      shipStrategy: i === 0 ? "FORWARD" : pickRandom(SHIP_STRATEGIES),
    })
  }

  return { vertices, edges }
}

export function generateJobExceptions(
  jobStatus: JobStatus,
  vertices: JobVertex[],
): JobException[] {
  // Healthy jobs get no exceptions
  if (jobStatus !== "FAILED" && jobStatus !== "FAILING") {
    return []
  }

  const count = 1 + Math.floor(Math.random() * 3)
  const exceptions: JobException[] = []
  const exceptionTemplates = [
    {
      name: "java.lang.NullPointerException",
      message: "Cannot invoke method on null reference",
      trace: `java.lang.NullPointerException: Cannot invoke method on null reference
\tat com.example.pipeline.ProcessFunction.processElement(ProcessFunction.java:42)
\tat org.apache.flink.streaming.api.operators.KeyedProcessOperator.processElement(KeyedProcessOperator.java:83)
\tat org.apache.flink.streaming.runtime.tasks.OneInputStreamTask$StreamTaskNetworkOutput.emitRecord(OneInputStreamTask.java:233)
\tat org.apache.flink.streaming.runtime.io.AbstractStreamTaskNetworkInput.processElement(AbstractStreamTaskNetworkInput.java:134)
\tat org.apache.flink.streaming.runtime.io.StreamOneInputProcessor.processInput(StreamOneInputProcessor.java:65)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.processInput(StreamTask.java:550)
\tat org.apache.flink.streaming.runtime.tasks.mailbox.MailboxProcessor.runMailboxLoop(MailboxProcessor.java:203)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.runMailboxLoop(StreamTask.java:804)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.invoke(StreamTask.java:756)
\tat org.apache.flink.runtime.taskmanager.Task.runWithSystemExitMonitoring(Task.java:953)
\tat org.apache.flink.runtime.taskmanager.Task.restoreAndInvoke(Task.java:932)
\tat org.apache.flink.runtime.taskmanager.Task.doRun(Task.java:746)
\tat org.apache.flink.runtime.taskmanager.Task.run(Task.java:562)
\tat java.lang.Thread.run(Thread.java:750)`,
    },
    {
      name: "org.apache.flink.util.FlinkRuntimeException",
      message:
        "Failed to deserialize record from Kafka: Corrupt message at offset 1542890",
      trace: `org.apache.flink.util.FlinkRuntimeException: Failed to deserialize record from Kafka: Corrupt message at offset 1542890
\tat org.apache.flink.connector.kafka.source.reader.deserializer.KafkaRecordDeserializationSchema.deserialize(KafkaRecordDeserializationSchema.java:78)
\tat org.apache.flink.connector.kafka.source.reader.KafkaSourceReader.pollNext(KafkaSourceReader.java:89)
\tat org.apache.flink.connector.base.source.reader.SourceReaderBase.pollNext(SourceReaderBase.java:143)
\tat org.apache.flink.streaming.api.operators.SourceOperator.emitNext(SourceOperator.java:385)
\tat org.apache.flink.streaming.runtime.io.StreamTaskSourceInput.emitNext(StreamTaskSourceInput.java:68)
\tat org.apache.flink.streaming.runtime.io.StreamOneInputProcessor.processInput(StreamOneInputProcessor.java:65)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.processInput(StreamTask.java:550)
\tat org.apache.flink.streaming.runtime.tasks.mailbox.MailboxProcessor.runMailboxLoop(MailboxProcessor.java:203)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.runMailboxLoop(StreamTask.java:804)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.invoke(StreamTask.java:756)
\tat org.apache.flink.runtime.taskmanager.Task.run(Task.java:562)
\tat java.lang.Thread.run(Thread.java:750)`,
    },
    {
      name: "java.io.IOException",
      message:
        "Connection reset by peer: JDBC sink lost connection to database",
      trace: `java.io.IOException: Connection reset by peer: JDBC sink lost connection to database
\tat java.net.SocketInputStream.read(SocketInputStream.java:186)
\tat com.mysql.cj.protocol.ReadAheadInputStream.fill(ReadAheadInputStream.java:107)
\tat org.apache.flink.connector.jdbc.internal.JdbcOutputFormat.flush(JdbcOutputFormat.java:211)
\tat org.apache.flink.connector.jdbc.internal.GenericJdbcSinkFunction.snapshotState(GenericJdbcSinkFunction.java:88)
\tat org.apache.flink.streaming.api.operators.StreamSink.snapshotState(StreamSink.java:56)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.performCheckpoint(StreamTask.java:1121)
\tat org.apache.flink.streaming.runtime.tasks.StreamTask.triggerCheckpointOnBarrier(StreamTask.java:1039)
\tat org.apache.flink.runtime.taskmanager.Task.run(Task.java:562)
\tat java.lang.Thread.run(Thread.java:750)`,
    },
  ]

  for (let i = 0; i < count; i++) {
    const template = exceptionTemplates[i % exceptionTemplates.length]
    const failedVertex =
      vertices.find((v) => v.status === "FAILED") ?? pickRandom(vertices)
    const subtaskIdx = Math.floor(Math.random() * failedVertex.parallelism)

    exceptions.push({
      timestamp: new Date(
        Date.now() - (count - i) * 30_000 - Math.floor(Math.random() * 60_000),
      ),
      name: template.name,
      message: template.message,
      stacktrace: template.trace,
      taskName: failedVertex.name,
      location: `${failedVertex.name} (${subtaskIdx + 1}/${failedVertex.parallelism})`,
    })
  }

  return exceptions.sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )
}

export function generateCheckpoints(jobStatus: JobStatus): {
  checkpoints: Checkpoint[]
  config: CheckpointConfig
} {
  const config: CheckpointConfig = {
    mode: "EXACTLY_ONCE",
    interval: pickRandom([30_000, 60_000, 120_000]),
    timeout: 600_000,
    minPause: pickRandom([10_000, 30_000]),
    maxConcurrent: 1,
  }

  const count = 20 + Math.floor(Math.random() * 11) // 20-30
  const checkpoints: Checkpoint[] = []
  const now = Date.now()

  // State size grows gradually over time (simulates state accumulation)
  const baseSizeStart = 10 + Math.floor(Math.random() * 100) // 10-110 MB
  const growthRate = 1 + Math.random() * 0.03 // 0-3% per checkpoint

  for (let i = 0; i < count; i++) {
    const triggerOffset =
      (count - i) * config.interval + Math.floor(Math.random() * 5000)
    const duration =
      100 + Math.floor(Math.random() * 400) + Math.floor(i * Math.random() * 5) // 100-500ms, slight drift
    const baseSize = Math.floor(baseSizeStart * growthRate ** i) // growing state
    // ~5% failure rate
    const isFailed = Math.random() < 0.05

    checkpoints.push({
      id: i + 1,
      status: isFailed ? "FAILED" : "COMPLETED",
      triggerTimestamp: new Date(now - triggerOffset),
      duration: isFailed ? 0 : duration,
      size: isFailed ? 0 : baseSize * MB,
      processedData: isFailed
        ? 0
        : Math.floor(baseSize * MB * (0.8 + Math.random() * 0.4)),
      isSavepoint: i === 0 && Math.random() < 0.2,
    })
  }

  // Optionally add an in-progress checkpoint for running jobs
  if (jobStatus === "RUNNING" && Math.random() < 0.5) {
    checkpoints.unshift({
      id: count + 1,
      status: "IN_PROGRESS",
      triggerTimestamp: new Date(now - 2000),
      duration: 0,
      size: 0,
      processedData: 0,
      isSavepoint: false,
    })
  }

  return { checkpoints, config }
}

export function generateSubtaskMetrics(
  vertices: JobVertex[],
): Record<string, SubtaskMetrics[]> {
  const result: Record<string, SubtaskMetrics[]> = {}

  for (const vertex of vertices) {
    const subtasks: SubtaskMetrics[] = []
    const baseRecords = 20_000 + Math.floor(Math.random() * 500_000)
    // Pick one subtask to be skewed (3-5x more records)
    const skewedIdx = Math.floor(Math.random() * vertex.parallelism)
    const skewFactor = 3 + Math.random() * 2

    for (let i = 0; i < vertex.parallelism; i++) {
      const multiplier =
        i === skewedIdx ? skewFactor : 0.8 + Math.random() * 0.4
      const recordsIn = Math.floor(baseRecords * multiplier)
      const recordsOut = Math.floor(recordsIn * (0.7 + Math.random() * 0.3))
      const busyMs = Math.floor(200 + Math.random() * 700)
      const bpMs = Math.floor(Math.random() * 300)
      const idleMs = Math.max(0, 1000 - busyMs - bpMs)
      const tmIdx = (i % 3) + 1

      subtasks.push({
        subtaskIndex: i,
        status: vertex.status,
        attempt: 0,
        endpoint: `tm-${tmIdx}:6122`,
        taskManagerId: `tm-${tmIdx}`,
        startTime: vertex.startTime,
        endTime:
          vertex.status === "RUNNING" ? -1 : vertex.startTime + vertex.duration,
        duration: vertex.duration,
        recordsIn,
        recordsOut,
        bytesIn: recordsIn * 256,
        bytesOut: recordsOut * 200,
        busyTimeMsPerSecond: busyMs,
        backPressuredTimeMsPerSecond: bpMs,
        idleTimeMsPerSecond: idleMs,
      })
    }

    result[vertex.id] = subtasks
  }

  return result
}

export function generateWatermarks(
  vertices: JobVertex[],
): Record<string, VertexWatermark[]> {
  const result: Record<string, VertexWatermark[]> = {}
  const now = Date.now()

  for (const vertex of vertices) {
    const wms: VertexWatermark[] = []
    for (let i = 0; i < vertex.parallelism; i++) {
      // Watermarks are slightly behind current time (1-30 seconds lag)
      const lag = 1000 + Math.floor(Math.random() * 29_000)
      wms.push({
        subtaskIndex: i,
        watermark: vertex.status === "RUNNING" ? now - lag : -Infinity,
      })
    }
    result[vertex.id] = wms
  }

  return result
}

export function generateBackPressure(
  vertices: JobVertex[],
): Record<string, VertexBackPressure> {
  const result: Record<string, VertexBackPressure> = {}
  const levels: Array<"ok" | "low" | "high"> = ["ok", "ok", "ok", "low", "high"]

  for (const vertex of vertices) {
    const subtasks: SubtaskBackPressure[] = []
    for (let i = 0; i < vertex.parallelism; i++) {
      const level = pickRandom(levels)
      const ratio =
        level === "ok"
          ? Math.random() * 0.1
          : level === "low"
            ? 0.1 + Math.random() * 0.4
            : 0.5 + Math.random() * 0.5
      const busyRatio = 0.3 + Math.random() * 0.5
      const idleRatio = Math.max(0, 1 - ratio - busyRatio)
      subtasks.push({ subtaskIndex: i, level, ratio, busyRatio, idleRatio })
    }

    // Overall level is the worst across subtasks
    const overallLevel = subtasks.some((s) => s.level === "high")
      ? "high"
      : subtasks.some((s) => s.level === "low")
        ? "low"
        : "ok"

    result[vertex.id] = {
      level: overallLevel,
      endTimestamp: Date.now(),
      subtasks,
    }
  }

  return result
}

export function generateAccumulators(
  vertices: JobVertex[],
): Record<string, UserAccumulator[]> {
  const result: Record<string, UserAccumulator[]> = {}

  const sampleAccumulators: UserAccumulator[][] = [
    [
      {
        name: "numRecordsProcessed",
        type: "LongCounter",
        value: String(10_000 + Math.floor(Math.random() * 500_000)),
      },
      {
        name: "numBytesProcessed",
        type: "LongCounter",
        value: String(2_000_000 + Math.floor(Math.random() * 100_000_000)),
      },
    ],
    [
      {
        name: "numLateRecordsDropped",
        type: "LongCounter",
        value: String(Math.floor(Math.random() * 100)),
      },
    ],
    [], // some vertices have no accumulators
  ]

  for (const vertex of vertices) {
    result[vertex.id] = pickRandom(sampleAccumulators)
  }

  return result
}

export function generateJobConfiguration(): JobConfiguration[] {
  return [
    { key: "execution.checkpointing.interval", value: "60s" },
    { key: "execution.checkpointing.mode", value: "EXACTLY_ONCE" },
    { key: "execution.checkpointing.timeout", value: "10min" },
    { key: "execution.checkpointing.min-pause", value: "30s" },
    { key: "execution.checkpointing.max-concurrent-checkpoints", value: "1" },
    { key: "execution.checkpointing.unaligned.enabled", value: "true" },
    { key: "state.backend.type", value: "rocksdb" },
    { key: "state.backend.incremental", value: "true" },
    { key: "state.checkpoints.dir", value: "s3://flink-checkpoints/prod" },
    { key: "state.savepoints.dir", value: "s3://flink-savepoints/prod" },
    { key: "state.checkpoints.num-retained", value: "3" },
    { key: "restart-strategy.type", value: "fixed-delay" },
    { key: "restart-strategy.fixed-delay.attempts", value: "3" },
    { key: "restart-strategy.fixed-delay.delay", value: "10s" },
    { key: "parallelism.default", value: "4" },
    { key: "pipeline.max-parallelism", value: "128" },
    { key: "pipeline.object-reuse", value: "true" },
    { key: "pipeline.auto-watermark-interval", value: "200ms" },
    { key: "taskmanager.numberOfTaskSlots", value: "4" },
    { key: "taskmanager.memory.process.size", value: "4096m" },
    { key: "taskmanager.memory.managed.size", value: "2048m" },
    { key: "taskmanager.network.memory.fraction", value: "0.1" },
    { key: "table.exec.state.ttl", value: "86400000" },
    { key: "table.exec.mini-batch.enabled", value: "true" },
    { key: "table.exec.mini-batch.allow-latency", value: "5s" },
    { key: "table.exec.mini-batch.size", value: "5000" },
    { key: "metrics.reporter.prom.port", value: "9249" },
    { key: "metrics.latency.interval", value: "2000" },
  ]
}

function generateJobDetailFields(
  parallelism: number,
  jobStatus: JobStatus,
  startTime: Date,
): Pick<
  FlinkJob,
  | "plan"
  | "exceptions"
  | "checkpoints"
  | "checkpointCounts"
  | "checkpointConfig"
  | "checkpointLatest"
  | "subtaskMetrics"
  | "configuration"
  | "watermarks"
  | "backpressure"
  | "accumulators"
> {
  const plan = generateJobPlan(parallelism, jobStatus, startTime)
  const exceptions = generateJobExceptions(jobStatus, plan.vertices)
  const { checkpoints, config } = generateCheckpoints(jobStatus)
  const checkpointCounts: CheckpointCounts = {
    completed: checkpoints.filter((c) => c.status === "COMPLETED").length,
    failed: checkpoints.filter((c) => c.status === "FAILED").length,
    inProgress: checkpoints.filter((c) => c.status === "IN_PROGRESS").length,
    total: checkpoints.length,
  }
  const subtaskMetrics = generateSubtaskMetrics(plan.vertices)
  const configuration = generateJobConfiguration()
  const watermarks = generateWatermarks(plan.vertices)
  const backpressure = generateBackPressure(plan.vertices)
  const accumulators = generateAccumulators(plan.vertices)

  return {
    plan,
    exceptions,
    checkpoints,
    checkpointCounts,
    checkpointConfig: config,
    checkpointLatest: null,
    subtaskMetrics,
    configuration,
    watermarks,
    backpressure,
    accumulators,
  }
}

// ---------------------------------------------------------------------------
// 2.1 — generateClusterOverview
// ---------------------------------------------------------------------------

export function generateClusterOverview(
  running: FlinkJob[],
  completed: FlinkJob[],
  tms: TaskManager[],
): ClusterOverview {
  const finishedCount = completed.filter((j) => j.status === "FINISHED").length
  const cancelledCount = completed.filter((j) => j.status === "CANCELED").length
  const failedCount = completed.filter((j) => j.status === "FAILED").length

  const totalSlots = tms.reduce((sum, tm) => sum + tm.slotsTotal, 0)
  const freeSlots = tms.reduce((sum, tm) => sum + tm.slotsFree, 0)

  return {
    flinkVersion: "1.20.0",
    flinkCommitId: "a1b2c3d",
    totalTaskSlots: totalSlots,
    availableTaskSlots: freeSlots,
    runningJobs: running.length,
    finishedJobs: finishedCount,
    cancelledJobs: cancelledCount,
    failedJobs: failedCount,
    taskManagerCount: tms.length,
  }
}

// ---------------------------------------------------------------------------
// 2.2 — generateRunningJobs
// ---------------------------------------------------------------------------

export function generateRunningJobs(): FlinkJob[] {
  if (cachedRunningJobs) return cachedRunningJobs

  const count = 2 + Math.floor(Math.random() * 3) // 2–4
  const used = new Set<string>()
  const jobs: FlinkJob[] = []

  for (let i = 0; i < count; i++) {
    let name: string
    do {
      name = pickRandom(ALL_JOB_NAMES)
    } while (used.has(name))
    used.add(name)

    const parallelism = pickRandom([2, 4, 4, 8])
    const startMin = 5 + Math.floor(Math.random() * 55) // 5–60 min ago
    const startTime = minutesAgo(startMin)

    jobs.push({
      id: hex(32),
      name,
      status: "RUNNING",
      startTime,
      endTime: null,
      duration: Date.now() - startTime.getTime(),
      tasks: generateTaskCounts(parallelism, "RUNNING"),
      parallelism,
      ...generateJobDetailFields(parallelism, "RUNNING", startTime),
    })
  }

  // Add a mock tap job so the TAP badge appears in the jobs table
  const tapStartTime = minutesAgo(2)
  jobs.push({
    id: hex(32),
    name: "flink-reactor-tap-Source: KafkaSource",
    status: "RUNNING",
    startTime: tapStartTime,
    endTime: null,
    duration: Date.now() - tapStartTime.getTime(),
    tasks: generateTaskCounts(1, "RUNNING"),
    parallelism: 1,
    ...generateJobDetailFields(1, "RUNNING", tapStartTime),
  })

  cachedRunningJobs = jobs
  return jobs
}

// ---------------------------------------------------------------------------
// 2.3 — generateCompletedJobs
// ---------------------------------------------------------------------------

export function generateCompletedJobs(): FlinkJob[] {
  if (cachedCompletedJobs) return cachedCompletedJobs

  const count = 5 + Math.floor(Math.random() * 6) // 5–10
  const statuses: JobStatus[] = [
    "FINISHED",
    "FINISHED",
    "FINISHED",
    "FINISHED",
    "FINISHED",
    "FAILED",
    "FAILED",
    "CANCELED",
  ]
  const jobs: FlinkJob[] = []

  for (let i = 0; i < count; i++) {
    const parallelism = pickRandom([2, 4, 4, 8])
    const status = pickRandom(statuses)
    const startHours = 1 + Math.floor(Math.random() * 48) // 1–48h ago
    const durationMs = (5 + Math.floor(Math.random() * 120)) * 60_000 // 5–125 min
    const startTime = hoursAgo(startHours)
    const endTime = new Date(startTime.getTime() + durationMs)

    jobs.push({
      id: hex(32),
      name: pickRandom(ALL_JOB_NAMES),
      status,
      startTime,
      endTime,
      duration: durationMs,
      tasks: generateTaskCounts(parallelism, status),
      parallelism,
      ...generateJobDetailFields(parallelism, status, startTime),
    })
  }

  // Sort by end time descending
  jobs.sort((a, b) => (b.endTime?.getTime() ?? 0) - (a.endTime?.getTime() ?? 0))

  cachedCompletedJobs = jobs
  return jobs
}

// ---------------------------------------------------------------------------
// 2.4 — generateTaskManagers
// ---------------------------------------------------------------------------

function generateTmMetrics(
  memCfg: TaskManagerMemoryConfiguration,
): TaskManagerMetrics {
  const heapMax = memCfg.frameworkHeap + memCfg.taskHeap
  const nonHeapMax = 738 * MB
  const directMax =
    memCfg.frameworkOffHeap + memCfg.taskOffHeap + memCfg.networkMemory
  const nettyTotal = memCfg.networkMemory

  const heapUsed = jitter(heapMax * 0.3, 0.15)
  const nonHeapUsed = jitter(64 * MB, 0.2)
  const directUsed = jitter(directMax * 0.5, 0.25)
  const nettyUsed = jitter(nettyTotal * 0.1, 0.3)
  const managedUsed = jitter(memCfg.managedMemory * 0.05, 0.5)
  const metaspaceUsed = jitter(41 * MB, 0.2)
  const segmentsTotal = Math.round(nettyTotal / (32 * 1024)) // 32KB per segment

  return {
    cpuUsage: 15 + Math.random() * 60,
    // JVM heap
    heapUsed,
    heapCommitted: heapMax,
    heapMax,
    // JVM non-heap
    nonHeapUsed,
    nonHeapCommitted: jitter(nonHeapUsed * 1.05, 0.02),
    nonHeapMax,
    // Direct / mapped
    directCount: 3000 + Math.floor(Math.random() * 2000),
    directUsed,
    directMax,
    mappedCount: 0,
    mappedUsed: 0,
    mappedMax: 0,
    // Netty shuffle
    nettyShuffleMemoryAvailable: nettyTotal - nettyUsed,
    nettyShuffleMemoryUsed: nettyUsed,
    nettyShuffleMemoryTotal: nettyTotal,
    nettyShuffleSegmentsAvailable:
      segmentsTotal - Math.floor(nettyUsed / (32 * 1024)),
    nettyShuffleSegmentsUsed: Math.floor(nettyUsed / (32 * 1024)),
    nettyShuffleSegmentsTotal: segmentsTotal,
    // Managed
    managedMemoryUsed: managedUsed,
    managedMemoryTotal: memCfg.managedMemory,
    // Metaspace
    metaspaceUsed,
    metaspaceMax: memCfg.jvmMetaspace,
    // GC
    garbageCollectors: [
      {
        name: "G1_Young_Generation",
        count: 80 + Math.floor(Math.random() * 150),
        time: 2000 + Math.floor(Math.random() * 3000),
      },
      {
        name: "G1_Old_Generation",
        count: Math.floor(Math.random() * 5),
        time: Math.floor(Math.random() * 500),
      },
      {
        name: "G1_Concurrent_GC",
        count: 3 + Math.floor(Math.random() * 10),
        time: 1 + Math.floor(Math.random() * 20),
      },
    ],
    // Threads
    threadCount: 40 + Math.floor(Math.random() * 30),
  }
}

function generateTmMemoryConfig(): TaskManagerMemoryConfiguration {
  const frameworkHeap = 128 * MB
  const taskHeap = 384 * MB
  const frameworkOffHeap = 128 * MB
  const taskOffHeap = 0
  const networkMemory = 128 * MB
  const managedMemory = 512 * MB
  const jvmMetaspace = 256 * MB
  const jvmOverhead = 192 * MB
  const totalFlinkMemory =
    frameworkHeap +
    taskHeap +
    frameworkOffHeap +
    taskOffHeap +
    networkMemory +
    managedMemory
  const totalProcessMemory = totalFlinkMemory + jvmMetaspace + jvmOverhead

  return {
    frameworkHeap,
    taskHeap,
    frameworkOffHeap,
    taskOffHeap,
    networkMemory,
    managedMemory,
    jvmMetaspace,
    jvmOverhead,
    totalFlinkMemory,
    totalProcessMemory,
  }
}

function generateTmResource(slotsTotal: number): TaskManagerResource {
  return {
    cpuCores: slotsTotal,
    taskHeapMemory: 383,
    taskOffHeapMemory: 0,
    managedMemory: 512,
    networkMemory: 128,
  }
}

// ---------------------------------------------------------------------------
// TM logs, stdout, log files, thread dump generators
// ---------------------------------------------------------------------------

function generateTmLogs(tmId: string): string {
  const lines = [
    `2025-01-15 10:00:01,234 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor             - Connecting to ResourceManager at akka.tcp://flink@flink-jobmanager:6123/user/rpc/resourcemanager_0.`,
    `2025-01-15 10:00:01,567 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor             - Successfully registered at ResourceManager.`,
    `2025-01-15 10:00:02,012 INFO  org.apache.flink.runtime.taskexecutor.slot.TaskSlotTableImpl   - Allocated slot for alloc-001 in slot index 0.`,
    `2025-01-15 10:00:02,345 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor             - Received task Source: KafkaSource -> Map (1/4), deploy into slot with allocation id alloc-001.`,
    `2025-01-15 10:00:02,678 INFO  org.apache.flink.runtime.taskmanager.Task                      - Source: KafkaSource -> Map (1/4) switched from CREATED to DEPLOYING.`,
    `2025-01-15 10:00:03,001 INFO  org.apache.flink.runtime.taskmanager.Task                      - Source: KafkaSource -> Map (1/4) switched from DEPLOYING to INITIALIZING.`,
    `2025-01-15 10:00:03,234 INFO  org.apache.flink.connector.kafka.source.reader.KafkaSourceReader - Consumer subtask 0 assigned to partitions [clicks-0, clicks-1].`,
    `2025-01-15 10:00:03,567 INFO  org.apache.flink.connector.kafka.source.reader.KafkaSourceReader - Consumer subtask 0 seeking to offset 50782 for partition clicks-0.`,
    `2025-01-15 10:00:04,012 INFO  org.apache.flink.runtime.taskmanager.Task                      - Source: KafkaSource -> Map (1/4) switched from INITIALIZING to RUNNING.`,
    `2025-01-15 10:00:05,234 INFO  org.apache.flink.runtime.io.network.netty.NettyServer          - Successful initialization (transport type: nio). Listening on port 6121.`,
    `2025-01-15 10:00:10,456 INFO  org.apache.flink.streaming.runtime.tasks.StreamTask            - Triggering checkpoint 1 on behalf of the CheckpointCoordinator.`,
    `2025-01-15 10:00:10,789 INFO  org.apache.flink.streaming.runtime.tasks.StreamTask            - Acknowledging checkpoint 1.`,
    `2025-01-15 10:00:15,123 INFO  org.apache.flink.runtime.state.heap.HeapKeyedStateBackend      - State backend initialized with heap memory at /tmp/flink-state/${tmId}/job_001.`,
    `2025-01-15 10:00:20,456 WARN  org.apache.flink.runtime.io.network.partition.ResultPartitionManager - Network buffer pool is running low on available buffers.`,
    `2025-01-15 10:00:25,789 INFO  org.apache.flink.streaming.runtime.tasks.StreamTask            - Triggering checkpoint 2 on behalf of the CheckpointCoordinator.`,
    `2025-01-15 10:00:26,012 INFO  org.apache.flink.streaming.runtime.tasks.StreamTask            - Acknowledging checkpoint 2.`,
    `2025-01-15 10:00:30,234 DEBUG org.apache.flink.streaming.runtime.tasks.StreamTask            - Processing watermark W(1706875234000).`,
    `2025-01-15 10:00:35,567 INFO  org.apache.flink.runtime.taskexecutor.TaskExecutor             - Received task Window(TumblingEventTimeWindows) -> Sink: Print (1/4), deploy into slot with allocation id alloc-002.`,
    `2025-01-15 10:00:35,890 INFO  org.apache.flink.runtime.taskmanager.Task                      - Window(TumblingEventTimeWindows) -> Sink: Print (1/4) switched from CREATED to DEPLOYING.`,
    `2025-01-15 10:00:36,123 INFO  org.apache.flink.runtime.taskmanager.Task                      - Window(TumblingEventTimeWindows) -> Sink: Print (1/4) switched from DEPLOYING to INITIALIZING.`,
    `2025-01-15 10:00:36,456 INFO  org.apache.flink.runtime.taskmanager.Task                      - Window(TumblingEventTimeWindows) -> Sink: Print (1/4) switched from INITIALIZING to RUNNING.`,
    `2025-01-15 10:00:40,789 INFO  org.apache.flink.streaming.runtime.tasks.StreamTask            - Triggering checkpoint 3 on behalf of the CheckpointCoordinator.`,
    `2025-01-15 10:00:41,012 INFO  org.apache.flink.streaming.runtime.tasks.StreamTask            - Acknowledging checkpoint 3.`,
    `2025-01-15 10:00:45,234 WARN  org.apache.flink.runtime.taskexecutor.TaskExecutor             - Slow garbage collection detected: G1 Young Generation GC took 245ms.`,
    `2025-01-15 10:00:50,567 INFO  org.apache.flink.connector.kafka.sink.KafkaWriter              - Kafka writer flushed 512 records to topic 'orders'.`,
    `2025-01-15 10:00:55,890 INFO  org.apache.flink.connector.kafka.sink.KafkaWriter              - Committing transaction for checkpoint 3.`,
  ]
  return lines.join("\n")
}

function generateTmStdoutText(tm: {
  id: string
  slotsTotal: number
  cpuCores: number
  physicalMemory: number
  metrics: TaskManagerMetrics
  memoryConfiguration: TaskManagerMemoryConfiguration
  path: string
}): string {
  return [
    `Starting Flink TaskManager (TaskManagerRunner)`,
    `  JVM version: 11.0.21+9`,
    `  Max heap size: ${Math.round(tm.metrics.heapMax / MB)} MB`,
    `  JVM args: -Xmx${Math.round(tm.metrics.heapMax / MB)}m -Xms${Math.round(tm.metrics.heapMax / MB)}m -XX:MaxMetaspaceSize=${Math.round(tm.memoryConfiguration.jvmMetaspace / MB)}m -XX:MaxDirectMemorySize=${Math.round(tm.memoryConfiguration.networkMemory / MB)}m`,
    `  Classpath: /opt/flink/lib/*`,
    `  Working directory: /opt/flink`,
    ``,
    `Flink version: 1.20.0`,
    `Scala version: 2.12`,
    `Build date: 2025-01-10T08:30:00Z`,
    `Commit: a1b2c3d`,
    ``,
    `TaskManager ID: ${tm.id}`,
    `Resource ID: ${tm.id}`,
    `Data port: 6121`,
    `Total task slots: ${tm.slotsTotal}`,
    `CPU cores: ${tm.cpuCores}`,
    `Physical memory: ${Math.round(tm.physicalMemory / GB)} GB`,
    `JVM heap size: ${Math.round(tm.metrics.heapMax / MB)} MB`,
    `Managed memory: ${Math.round(tm.memoryConfiguration.managedMemory / MB)} MB`,
    `Network memory: ${Math.round(tm.memoryConfiguration.networkMemory / MB)} MB`,
    ``,
    `Connecting to ResourceManager at ${tm.path.split("/user")[0]}`,
    `Successfully registered at ResourceManager.`,
  ].join("\n")
}

function generateTmLogFiles(tmIndex: number): LogFileEntry[] {
  const now = Date.now()
  const entries: LogFileEntry[] = []
  const ordinal = String(tmIndex)

  // Primary taskexecutor log
  entries.push({
    name: `flink-${LOG_USER}-taskexecutor-${ordinal}-${LOG_HOST}.log`,
    lastModified: new Date(now - Math.floor(Math.random() * 3_600_000)),
    size: 33.42,
  })

  // Rotated taskexecutor logs
  for (let r = 1; r <= 2; r++) {
    const daysAgo = r + Math.floor(Math.random() * 3)
    entries.push({
      name: `flink-${LOG_USER}-taskexecutor-${ordinal}-${LOG_HOST}.log.${r}`,
      lastModified: new Date(
        now - daysAgo * 86_400_000 - Math.floor(Math.random() * 43_200_000),
      ),
      size: Number((5 + Math.random() * 45).toFixed(2)),
    })
  }

  // Taskexecutor .out file
  entries.push({
    name: `flink-${LOG_USER}-taskexecutor-${ordinal}-${LOG_HOST}.out`,
    lastModified: new Date(
      now - 2 * 86_400_000 - Math.floor(Math.random() * 43_200_000),
    ),
    size: 0,
  })

  // GC log
  entries.push({
    name: `flink-${LOG_USER}-taskexecutor-${ordinal}-${LOG_HOST}-gc.log`,
    lastModified: new Date(now - Math.floor(Math.random() * 7_200_000)),
    size: Number((2 + Math.random() * 15).toFixed(2)),
  })

  entries.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  return entries
}

function generateTmThreadDump(): ThreadDumpInfo {
  const threads: ThreadDumpEntry[] = [
    // --- main thread ---
    {
      name: "main",
      id: 1,
      state: "WAITING",
      lockObject: "java.util.concurrent.CompletableFuture$Signaller@48cd2176",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.CompletableFuture$Signaller@48cd2176",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:221)",
        "at java.base@21.0.9/java.util.concurrent.CompletableFuture$Signaller.block(CompletableFuture.java:1864)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3780)",
        "at java.base@21.0.9/java.util.concurrent.CompletableFuture.waitingGet(CompletableFuture.java:1898)",
        "at java.base@21.0.9/java.util.concurrent.CompletableFuture.get(CompletableFuture.java:2072)",
        "at app//org.apache.flink.runtime.taskexecutor.TaskManagerRunner.runTaskManager(TaskManagerRunner.java:342)",
        "at app//org.apache.flink.runtime.taskexecutor.TaskManagerRunner.main(TaskManagerRunner.java:405)",
      ],
      lockedSynchronizers: [],
    },
    // --- Task execution threads ---
    {
      name: "Source: KafkaSource -> Map (1/4)#0",
      id: 30,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at app//org.apache.flink.connector.kafka.source.reader.KafkaSourceReader.pollNext(KafkaSourceReader.java:127)",
        "at app//org.apache.flink.streaming.api.operators.SourceOperator.emitNext(SourceOperator.java:419)",
        "at app//org.apache.flink.streaming.runtime.io.StreamTaskSourceInput.emitNext(StreamTaskSourceInput.java:68)",
        "at app//org.apache.flink.streaming.runtime.io.StreamOneInputProcessor.processInput(StreamOneInputProcessor.java:65)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.processInput(StreamTask.java:550)",
        "at app//org.apache.flink.streaming.runtime.tasks.mailbox.MailboxProcessor.runMailboxLoop(MailboxProcessor.java:231)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.runMailboxLoop(StreamTask.java:839)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.invoke(StreamTask.java:788)",
        "at app//org.apache.flink.runtime.taskmanager.Task.runWithSystemExitMonitoring(Task.java:952)",
        "at app//org.apache.flink.runtime.taskmanager.Task.restoreAndInvoke(Task.java:931)",
        "at app//org.apache.flink.runtime.taskmanager.Task.doRun(Task.java:745)",
        "at app//org.apache.flink.runtime.taskmanager.Task.run(Task.java:562)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    {
      name: "Source: KafkaSource -> Map (2/4)#0",
      id: 31,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at app//org.apache.flink.connector.kafka.source.reader.KafkaSourceReader.pollNext(KafkaSourceReader.java:127)",
        "at app//org.apache.flink.streaming.api.operators.SourceOperator.emitNext(SourceOperator.java:419)",
        "at app//org.apache.flink.streaming.runtime.io.StreamTaskSourceInput.emitNext(StreamTaskSourceInput.java:68)",
        "at app//org.apache.flink.streaming.runtime.io.StreamOneInputProcessor.processInput(StreamOneInputProcessor.java:65)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.processInput(StreamTask.java:550)",
        "at app//org.apache.flink.streaming.runtime.tasks.mailbox.MailboxProcessor.runMailboxLoop(MailboxProcessor.java:231)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.runMailboxLoop(StreamTask.java:839)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.invoke(StreamTask.java:788)",
        "at app//org.apache.flink.runtime.taskmanager.Task.runWithSystemExitMonitoring(Task.java:952)",
        "at app//org.apache.flink.runtime.taskmanager.Task.restoreAndInvoke(Task.java:931)",
        "at app//org.apache.flink.runtime.taskmanager.Task.doRun(Task.java:745)",
        "at app//org.apache.flink.runtime.taskmanager.Task.run(Task.java:562)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    {
      name: "Window(TumblingEventTimeWindows) -> Sink: Print (1/4)#0",
      id: 32,
      state: "WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@5a5b1e04",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@5a5b1e04",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:221)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:519)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3780)",
        "at app//org.apache.flink.streaming.runtime.tasks.mailbox.MailboxProcessor.runMailboxLoop(MailboxProcessor.java:196)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.runMailboxLoop(StreamTask.java:839)",
        "at app//org.apache.flink.streaming.runtime.tasks.StreamTask.invoke(StreamTask.java:788)",
        "at app//org.apache.flink.runtime.taskmanager.Task.runWithSystemExitMonitoring(Task.java:952)",
        "at app//org.apache.flink.runtime.taskmanager.Task.restoreAndInvoke(Task.java:931)",
        "at app//org.apache.flink.runtime.taskmanager.Task.doRun(Task.java:745)",
        "at app//org.apache.flink.runtime.taskmanager.Task.run(Task.java:562)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Checkpoint timer ---
    {
      name: "Checkpoint Timer",
      id: 33,
      state: "TIMED_WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@3e7b1d02",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@3e7b1d02",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:269)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:1797)",
        "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1182)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Netty data server threads ---
    ...([1, 2, 3, 4] as const).map(
      (n): ThreadDumpEntry => ({
        name: `flink-netty-server-${n}`,
        id: 34 + n,
        state: "RUNNABLE",
        lockObject: null,
        isNative: true,
        stackFrames: [
          "at java.base@21.0.9/sun.nio.ch.KQueue.poll(Native Method)",
          "at java.base@21.0.9/sun.nio.ch.KQueueSelectorImpl.doSelect(KQueueSelectorImpl.java:125)",
          "at java.base@21.0.9/sun.nio.ch.SelectorImpl.lockAndDoSelect(SelectorImpl.java:130)",
          `-  locked org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySet@${hex(8)}`,
          `-  locked sun.nio.ch.KQueueSelectorImpl@${hex(8)}`,
          "at java.base@21.0.9/sun.nio.ch.SelectorImpl.select(SelectorImpl.java:147)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySetSelector.select(SelectedSelectionKeySetSelector.java:68)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.select(NioEventLoop.java:879)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.run(NioEventLoop.java:526)",
          "at app//org.apache.flink.shaded.netty4.io.netty.util.concurrent.SingleThreadEventExecutor$4.run(SingleThreadEventExecutor.java:997)",
          "at app//org.apache.flink.shaded.netty4.io.netty.util.internal.ThreadExecutorMap$2.run(ThreadExecutorMap.java:74)",
          "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
          "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Pekko actor dispatchers ---
    ...([3, 5, 7] as const).map(
      (n): ThreadDumpEntry => ({
        name: `flink-pekko.actor.default-dispatcher-${n}`,
        id: 40 + n,
        state: "WAITING",
        lockObject: "org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@1a2b3c4d",
        isNative: false,
        stackFrames: [
          "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
          "-  waiting on org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@1a2b3c4d",
          "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:371)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.awaitWork(ForkJoinPool.java:1893)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:1809)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:188)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Memory manager thread ---
    {
      name: "flink-memory-manager-io-0",
      id: 50,
      state: "WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@7c8d9e0f",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@7c8d9e0f",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:221)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:519)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3780)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3725)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1746)",
        "at java.base@21.0.9/java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:435)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Metrics reporter ---
    {
      name: "flink-metrics-scheduler-1",
      id: 51,
      state: "TIMED_WAITING",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.Thread.sleep0(Native Method)",
        "at java.base@21.0.9/java.lang.Thread.sleep(Thread.java:509)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler.waitNanos(LightArrayRevolverScheduler.scala:121)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler$anon$3.nextTick(LightArrayRevolverScheduler.scala:314)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler$anon$3.run(LightArrayRevolverScheduler.scala:284)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- GC thread ---
    {
      name: "G1 Young RemSet Sampling",
      id: 15,
      state: "TIMED_WAITING",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.Thread.sleep0(Native Method)",
        "at java.base@21.0.9/java.lang.Thread.sleep(Thread.java:509)",
      ],
      lockedSynchronizers: [],
    },
    // --- Reference Handler ---
    {
      name: "Reference Handler",
      id: 9,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.ref.Reference.waitForReferencePendingList(Native Method)",
        "at java.base@21.0.9/java.lang.ref.Reference.processPendingReferences(Reference.java:246)",
        "at java.base@21.0.9/java.lang.ref.Reference$ReferenceHandler.run(Reference.java:208)",
      ],
      lockedSynchronizers: [],
    },
    // --- The active thread taking the dump ---
    {
      name: "flink-pekko.actor.default-dispatcher-12",
      id: 52,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.management@21.0.9/sun.management.ThreadImpl.dumpThreads0(Native Method)",
        "at java.management@21.0.9/sun.management.ThreadImpl.dumpAllThreads(ThreadImpl.java:518)",
        "at java.management@21.0.9/sun.management.ThreadImpl.dumpAllThreads(ThreadImpl.java:506)",
        "at app//org.apache.flink.runtime.util.JvmUtils.createThreadDump(JvmUtils.java:50)",
        "at app//org.apache.flink.runtime.rest.messages.ThreadDumpInfo.dumpAndCreate(ThreadDumpInfo.java:59)",
        "at app//org.apache.flink.runtime.taskexecutor.TaskExecutor.requestThreadDump(TaskExecutor.java:1428)",
        "at java.base@21.0.9/java.lang.invoke.LambdaForm$DMH/0x0000009801198000.invokeVirtual(LambdaForm$DMH)",
        "at java.base@21.0.9/java.lang.invoke.LambdaForm$MH/0x00000098012b4400.invoke(LambdaForm$MH)",
        "at java.base@21.0.9/java.lang.invoke.Invokers$Holder.invokeExact_MT(Invokers$Holder)",
        "at java.base@21.0.9/jdk.internal.reflect.DirectMethodHandleAccessor.invokeImpl(DirectMethodHandleAccessor.java:154)",
        "at java.base@21.0.9/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)",
        "at java.base@21.0.9/java.lang.reflect.Method.invoke(Method.java:580)",
        "at org.apache.flink.runtime.rpc.pekko.PekkoRpcActor.lambda$handleRpcInvocation$1(PekkoRpcActor.java:318)",
        "at app//org.apache.flink.runtime.concurrent.ClassLoadingUtils.runWithContextClassLoader(ClassLoadingUtils.java:83)",
        "at org.apache.flink.runtime.rpc.pekko.PekkoRpcActor.handleRpcInvocation(PekkoRpcActor.java:316)",
        "at org.apache.flink.runtime.rpc.pekko.PekkoRpcActor.handleRpcMessage(PekkoRpcActor.java:229)",
      ],
      lockedSynchronizers: [],
    },
  ]

  const threadInfos: ThreadInfoRaw[] = threads.map((t) => ({
    threadName: t.name,
    stringifiedThreadInfo: threadToStringifiedInfo(t),
  }))
  return { threadInfos }
}

export function generateTaskManagers(): TaskManager[] {
  if (cachedTaskManagers) return cachedTaskManagers

  const tmIds = PLACEHOLDER_VALUES.TM_ID
  const tmAddrs = PLACEHOLDER_VALUES.TM_ADDR

  const result = TASK_MANAGERS.map((_src, i) => {
    const slotsTotal = 4
    const slotsFree = 1 + Math.floor(Math.random() * 2)
    const memCfg = generateTmMemoryConfig()
    const totalResource = generateTmResource(slotsTotal)
    const freeResource: TaskManagerResource = {
      cpuCores: slotsFree,
      taskHeapMemory: Math.round(
        totalResource.taskHeapMemory * (slotsFree / slotsTotal),
      ),
      taskOffHeapMemory: 0,
      managedMemory: Math.round(
        totalResource.managedMemory * (slotsFree / slotsTotal),
      ),
      networkMemory: Math.round(
        totalResource.networkMemory * (slotsFree / slotsTotal),
      ),
    }

    const tmId = tmIds[i] ?? `container_unknown_${i}`
    const tmPath =
      tmAddrs[i] ?? `pekko.tcp://flink@tm-${i + 1}:6122/user/rpc/taskmanager_0`
    const metrics = generateTmMetrics(memCfg)

    return {
      id: tmId,
      path: tmPath,
      dataPort: 6121,
      jmxPort: -1,
      lastHeartbeat: new Date(Date.now() - Math.floor(Math.random() * 5000)),
      slotsTotal,
      slotsFree,
      cpuCores: 8,
      physicalMemory: 32 * GB,
      freeMemory: memCfg.frameworkHeap + memCfg.taskHeap,
      totalResource,
      freeResource,
      memoryConfiguration: memCfg,
      allocatedSlots: [],
      metrics,
      logs: generateTmLogs(tmId),
      stdout: generateTmStdoutText({
        id: tmId,
        slotsTotal,
        cpuCores: 8,
        physicalMemory: 32 * GB,
        metrics,
        memoryConfiguration: memCfg,
        path: tmPath,
      }),
      logFiles: generateTmLogFiles(i),
      threadDump: generateTmThreadDump(),
    }
  }) as TaskManager[]

  cachedTaskManagers = result
  return result
}

// ---------------------------------------------------------------------------
// 2.5 — generateJobManagerInfo
// ---------------------------------------------------------------------------

const FLINK_CONFIG: JobManagerConfig[] = [
  // JobManager
  { key: "jobmanager.rpc.address", value: "flink-jobmanager" },
  { key: "jobmanager.rpc.port", value: "6123" },
  { key: "jobmanager.memory.process.size", value: "2048m" },
  { key: "jobmanager.memory.heap.size", value: "1024m" },
  { key: "jobmanager.memory.off-heap.size", value: "512m" },
  { key: "jobmanager.memory.jvm-metaspace.size", value: "256m" },
  { key: "jobmanager.memory.jvm-overhead.min", value: "192m" },
  { key: "jobmanager.memory.jvm-overhead.max", value: "256m" },
  { key: "jobmanager.execution.failover-strategy", value: "region" },
  { key: "jobmanager.scheduler", value: "adaptive" },
  { key: "jobmanager.adaptive-scheduler.min-parallelism-increase", value: "1" },
  // TaskManager
  { key: "taskmanager.memory.process.size", value: "4096m" },
  { key: "taskmanager.memory.flink.size", value: "3072m" },
  { key: "taskmanager.memory.managed.size", value: "2048m" },
  { key: "taskmanager.memory.network.min", value: "256m" },
  { key: "taskmanager.memory.network.max", value: "512m" },
  { key: "taskmanager.memory.jvm-metaspace.size", value: "256m" },
  { key: "taskmanager.memory.framework.heap.size", value: "128m" },
  { key: "taskmanager.memory.task.heap.size", value: "1536m" },
  { key: "taskmanager.numberOfTaskSlots", value: "4" },
  { key: "taskmanager.cpu.cores", value: "4.0" },
  { key: "taskmanager.registration.timeout", value: "5 min" },
  { key: "taskmanager.slot.timeout", value: "10 s" },
  // State backend
  { key: "state.backend.type", value: "rocksdb" },
  { key: "state.backend.incremental", value: "true" },
  { key: "state.backend.rocksdb.localdir", value: "/tmp/flink-rocksdb" },
  { key: "state.backend.rocksdb.timer-service.factory", value: "ROCKSDB" },
  { key: "state.checkpoints.dir", value: "s3://flink-checkpoints/prod" },
  { key: "state.savepoints.dir", value: "s3://flink-savepoints/prod" },
  { key: "state.checkpoints.num-retained", value: "3" },
  // Checkpointing
  { key: "execution.checkpointing.interval", value: "30s" },
  { key: "execution.checkpointing.timeout", value: "10min" },
  { key: "execution.checkpointing.min-pause", value: "10s" },
  { key: "execution.checkpointing.max-concurrent-checkpoints", value: "1" },
  { key: "execution.checkpointing.mode", value: "EXACTLY_ONCE" },
  { key: "execution.checkpointing.unaligned.enabled", value: "true" },
  // Restart strategy
  { key: "restart-strategy.type", value: "fixed-delay" },
  { key: "restart-strategy.fixed-delay.attempts", value: "3" },
  { key: "restart-strategy.fixed-delay.delay", value: "10s" },
  // REST
  { key: "rest.port", value: "8081" },
  { key: "rest.bind-address", value: "0.0.0.0" },
  { key: "rest.bind-port", value: "8081" },
  { key: "rest.flamegraph.enabled", value: "true" },
  // Web UI
  { key: "web.submit.enable", value: "true" },
  { key: "web.cancel.enable", value: "true" },
  { key: "web.upload.dir", value: "/opt/flink/upload" },
  { key: "web.history", value: "20" },
  // Parallelism
  { key: "parallelism.default", value: "4" },
  { key: "pipeline.max-parallelism", value: "128" },
  { key: "pipeline.object-reuse", value: "true" },
  // High availability
  { key: "high-availability.type", value: "kubernetes" },
  { key: "high-availability.storageDir", value: "s3://flink-ha/prod" },
  { key: "high-availability.cluster-id", value: "flink-reactor-prod" },
  // Kubernetes
  { key: "kubernetes.cluster-id", value: "flink-reactor-prod" },
  { key: "kubernetes.namespace", value: "flink" },
  { key: "kubernetes.container.image", value: "flink:1.20.0-scala_2.12" },
  { key: "kubernetes.container.image.pull-policy", value: "IfNotPresent" },
  { key: "kubernetes.jobmanager.replicas", value: "1" },
  { key: "kubernetes.taskmanager.cpu.amount", value: "4.0" },
  { key: "kubernetes.taskmanager.cpu.limit-factor", value: "1.0" },
  { key: "kubernetes.rest-service.exposed.type", value: "LoadBalancer" },
  {
    key: "kubernetes.pod-template-file.default",
    value: "/opt/flink/pod-template.yaml",
  },
  // Metrics
  {
    key: "metrics.reporter.prom.factory.class",
    value: "org.apache.flink.metrics.prometheus.PrometheusReporterFactory",
  },
  { key: "metrics.reporter.prom.port", value: "9249" },
  { key: "metrics.latency.interval", value: "2000" },
  { key: "metrics.fetcher.update-interval", value: "10000" },
  // Network
  { key: "taskmanager.network.memory.fraction", value: "0.1" },
  { key: "taskmanager.network.memory.min", value: "64mb" },
  { key: "taskmanager.network.memory.max", value: "1gb" },
  { key: "taskmanager.network.request-backoff.initial", value: "100" },
  { key: "taskmanager.network.request-backoff.max", value: "10000" },
  // Blob server
  { key: "blob.server.port", value: "6124" },
  { key: "blob.storage.directory", value: "/tmp/flink-blobs" },
  // Classloader
  { key: "classloader.resolve-order", value: "parent-first" },
  { key: "classloader.check-leaked-classloader", value: "true" },
  // Akka
  { key: "akka.ask.timeout", value: "10s" },
  { key: "akka.framesize", value: "10485760b" },
  { key: "akka.lookup.timeout", value: "10s" },
  // Security
  { key: "security.ssl.internal.enabled", value: "false" },
  { key: "security.ssl.rest.enabled", value: "false" },
]

function generateJmMetricSeries(
  baseValue: number,
  variance: number,
  points: number,
): JvmMetricSample[] {
  const now = Date.now()
  const samples: JvmMetricSample[] = []

  for (let i = 0; i < points; i++) {
    samples.push({
      timestamp: new Date(now - (points - 1 - i) * 5000),
      value: jitter(baseValue, variance),
    })
  }

  return samples
}

// ---------------------------------------------------------------------------
// JVM info generator
// ---------------------------------------------------------------------------

function generateJvmInfo(): JvmInfo {
  return {
    arguments: [
      "-Xmx1024m",
      "-Xms1024m",
      "-XX:MaxMetaspaceSize=256m",
      "-XX:+UseG1GC",
      "-XX:MaxGCPauseMillis=100",
      "-XX:+ParallelRefProcEnabled",
      "-XX:+ExplicitGCInvokesConcurrent",
      "-XX:+HeapDumpOnOutOfMemoryError",
      "-XX:HeapDumpPath=/opt/flink/log",
      "-Dlog4j.configurationFile=/opt/flink/conf/log4j.properties",
      "-Dlog.file=/opt/flink/log/flink-jobmanager.log",
      "-Dflink.log.dir=/opt/flink/log",
      "-Dlogback.configurationFile=/opt/flink/conf/logback.xml",
      "-Djava.io.tmpdir=/tmp",
    ],
    systemProperties: [
      { key: "java.version", value: "11.0.21" },
      { key: "java.vendor", value: "Eclipse Adoptium" },
      { key: "java.vm.name", value: "OpenJDK 64-Bit Server VM" },
      { key: "java.vm.version", value: "11.0.21+9" },
      { key: "os.name", value: "Linux" },
      { key: "os.version", value: "5.15.0-91-generic" },
      { key: "os.arch", value: "amd64" },
      { key: "user.dir", value: "/opt/flink" },
      { key: "user.name", value: "flink" },
      { key: "file.encoding", value: "UTF-8" },
      { key: "java.class.path", value: "/opt/flink/lib/*" },
      { key: "sun.boot.class.path", value: "/usr/lib/jvm/java-11/lib/modules" },
    ],
    memoryConfig: {
      heapMax: 1024 * MB,
      heapUsed: Math.floor(jitter(620 * MB, 0.1)),
      nonHeapMax: 256 * MB,
      nonHeapUsed: Math.floor(jitter(120 * MB, 0.1)),
      metaspaceMax: 256 * MB,
      metaspaceUsed: Math.floor(jitter(95 * MB, 0.1)),
      directMax: 128 * MB,
      directUsed: Math.floor(jitter(42 * MB, 0.15)),
    },
  }
}

// ---------------------------------------------------------------------------
// Classpath generator
// ---------------------------------------------------------------------------

function classifyJar(filename: string): string {
  if (/^flink-dist/.test(filename)) return "flink-core"
  if (/^flink-runtime/.test(filename)) return "flink-core"
  if (/^flink-core/.test(filename)) return "flink-core"
  if (/^flink-optimizer/.test(filename)) return "flink-core"
  if (/^flink-rpc/.test(filename)) return "flink-core"
  if (/^flink-csv/.test(filename)) return "flink-core"
  if (/^flink-json/.test(filename)) return "flink-core"
  if (/^flink-connector-files/.test(filename)) return "flink-core"
  if (/^flink-table|^flink-sql-parser|^flink-cep/.test(filename))
    return "flink-sql"
  if (/connector|kafka|jdbc|elasticsearch|hive|hbase|pulsar/.test(filename))
    return "connector"
  if (/^log4j|^slf4j|logback/.test(filename)) return "log4j"
  if (/^hadoop|^hdfs/.test(filename)) return "hadoop"
  if (/^scala-|^flink-scala/.test(filename)) return "scala"
  return "other"
}

const CLASSPATH_JARS: { filename: string; size: number }[] = [
  // Core Flink distribution
  { filename: "flink-dist-2.0.1.jar", size: 142_567_890 },
  { filename: "flink-cep-2.0.1.jar", size: 1_567_890 },
  { filename: "flink-connector-files-2.0.1.jar", size: 2_345_678 },
  { filename: "flink-csv-2.0.1.jar", size: 456_789 },
  { filename: "flink-json-2.0.1.jar", size: 678_901 },
  // SQL / Table API
  { filename: "flink-table-api-java-uber-2.0.1.jar", size: 48_901_234 },
  { filename: "flink-table-planner-loader-2.0.1.jar", size: 45_678_901 },
  { filename: "flink-table-runtime-2.0.1.jar", size: 8_901_234 },
  // Scala
  { filename: "flink-scala_2.12-2.0.1.jar", size: 5_456_789 },
  // Logging
  { filename: "log4j-1.2-api-2.24.3.jar", size: 67_890 },
  { filename: "log4j-api-2.24.3.jar", size: 301_234 },
  { filename: "log4j-core-2.24.3.jar", size: 1_789_012 },
  { filename: "log4j-slf4j-impl-2.24.3.jar", size: 24_567 },
  // User-added connectors (typical additions)
  { filename: "flink-sql-connector-kafka-3.3.0-2.0.jar", size: 15_678_901 },
  { filename: "flink-connector-jdbc-3.2.0-2.0.jar", size: 4_567_890 },
  {
    filename: "flink-sql-connector-elasticsearch7-4.0.0-2.0.jar",
    size: 8_234_567,
  },
  { filename: "flink-sql-connector-hive-3.1.3-2.0.jar", size: 18_901_234 },
  // Hadoop ecosystem
  { filename: "hadoop-common-3.3.4.jar", size: 4_123_456 },
  { filename: "hadoop-hdfs-client-3.3.4.jar", size: 5_678_901 },
  { filename: "hadoop-auth-3.3.4.jar", size: 234_567 },
  { filename: "hadoop-mapreduce-client-core-3.3.4.jar", size: 1_890_123 },
  // Other libraries
  { filename: "commons-math3-3.6.1.jar", size: 2_123_456 },
  { filename: "commons-lang3-3.12.0.jar", size: 612_345 },
  { filename: "guava-31.1-jre.jar", size: 2_890_123 },
  { filename: "jackson-core-2.15.3.jar", size: 567_890 },
]

function generateClasspath(): ClasspathEntry[] {
  return CLASSPATH_JARS.map((jar) => ({
    path: `/opt/flink/lib/${jar.filename}`,
    filename: jar.filename,
    size: jar.size,
    tag: classifyJar(jar.filename),
  }))
}

// ---------------------------------------------------------------------------
// Log file list generator
// ---------------------------------------------------------------------------

const LOG_HOST = "FA:54:01:54:A8:3D"
const LOG_USER = "ahmed"

const LOG_FILES_TEMPLATE: {
  component: string
  ordinal: string
  ext: string
  sizeKB: number
  rotations: number
}[] = [
  {
    component: "standalonesession",
    ordinal: "0",
    ext: "log",
    sizeKB: 41.9,
    rotations: 3,
  },
  {
    component: "standalonesession",
    ordinal: "0",
    ext: "out",
    sizeKB: 0,
    rotations: 0,
  },
  {
    component: "taskexecutor",
    ordinal: "0",
    ext: "log",
    sizeKB: 33.42,
    rotations: 1,
  },
  {
    component: "taskexecutor",
    ordinal: "0",
    ext: "out",
    sizeKB: 0,
    rotations: 0,
  },
  { component: "client", ordinal: "", ext: "log", sizeKB: 13.18, rotations: 0 },
]

function generateLogFiles(): LogFileEntry[] {
  const now = Date.now()
  const entries: LogFileEntry[] = []

  for (const tmpl of LOG_FILES_TEMPLATE) {
    const ordinalSuffix = tmpl.ordinal ? `-${tmpl.ordinal}` : ""
    const baseName = `flink-${LOG_USER}-${tmpl.component}${ordinalSuffix}-${LOG_HOST}`

    // Primary file (most recently modified)
    entries.push({
      name: `${baseName}.${tmpl.ext}`,
      lastModified: new Date(now - Math.floor(Math.random() * 3_600_000)),
      size: tmpl.sizeKB,
    })

    // Rotated files (.log.1, .log.2, etc.) — older timestamps
    for (let r = 1; r <= tmpl.rotations; r++) {
      const daysAgo = r * 1 + Math.floor(Math.random() * 3)
      entries.push({
        name: `${baseName}.${tmpl.ext}.${r}`,
        lastModified: new Date(
          now - daysAgo * 86_400_000 - Math.floor(Math.random() * 43_200_000),
        ),
        size: Number((5 + Math.random() * 45).toFixed(2)),
      })
    }
  }

  // Sort by lastModified descending
  entries.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime())
  return entries
}

/** Generate realistic log content for a given log file name. */
export function generateLogFileContent(fileName: string): string {
  const isOut = fileName.endsWith(".out")
  if (isOut) {
    // .out files are typically empty or contain JVM startup info
    const isStdout = fileName.includes("standalonesession")
    if (isStdout) {
      return [
        "Starting Flink StandaloneSession (StandaloneSessionClusterEntrypoint)",
        "  JVM version: 11.0.21+9",
        "  Max heap size: 1024 MB",
        "  Working directory: /opt/flink",
      ].join("\n")
    }
    return ""
  }

  const isClient = fileName.includes("client")
  const isTm = fileName.includes("taskexecutor")
  const isRotated = /\.\d+$/.test(fileName)

  // Generate realistic log4j entries
  const lines: string[] = []
  const baseDate = isRotated
    ? new Date(Date.now() - 4 * 86_400_000)
    : new Date(Date.now() - 3_600_000)
  const lineCount = isClient ? 40 : isRotated ? 80 : 120

  const componentLoggers = isTm
    ? [
        "org.apache.flink.runtime.taskexecutor.TaskExecutor",
        "org.apache.flink.runtime.taskexecutor.slot.TaskSlotTableImpl",
        "org.apache.flink.runtime.taskmanager.Task",
        "org.apache.flink.runtime.io.network.netty.NettyServer",
        "org.apache.flink.runtime.io.network.partition.ResultPartitionManager",
        "org.apache.flink.runtime.state.heap.HeapKeyedStateBackend",
        "org.apache.flink.streaming.runtime.tasks.StreamTask",
        "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
      ]
    : isClient
      ? [
          "org.apache.flink.client.cli.CliFrontend",
          "org.apache.flink.client.program.PackagedProgram",
          "org.apache.flink.client.deployment.StandaloneClientFactory",
          "org.apache.flink.configuration.GlobalConfiguration",
        ]
      : [
          "org.apache.flink.runtime.entrypoint.ClusterEntrypoint",
          "org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint",
          "org.apache.flink.runtime.resourcemanager.StandaloneResourceManager",
          "org.apache.flink.runtime.dispatcher.StandaloneDispatcher",
          "org.apache.flink.runtime.jobmaster.JobMaster",
          "org.apache.flink.runtime.blob.BlobServer",
          "org.apache.flink.runtime.checkpoint.CheckpointCoordinator",
          "org.apache.flink.runtime.executiongraph.ExecutionGraph",
        ]

  const levels = ["INFO", "INFO", "INFO", "INFO", "INFO", "DEBUG", "WARN"]

  for (let i = 0; i < lineCount; i++) {
    const ts = new Date(
      baseDate.getTime() + i * 1500 + Math.floor(Math.random() * 500),
    )
    const yyyy = ts.getFullYear()
    const MM = String(ts.getMonth() + 1).padStart(2, "0")
    const dd = String(ts.getDate()).padStart(2, "0")
    const HH = String(ts.getHours()).padStart(2, "0")
    const mm = String(ts.getMinutes()).padStart(2, "0")
    const ss = String(ts.getSeconds()).padStart(2, "0")
    const ms = String(ts.getMilliseconds()).padStart(3, "0")
    const timestamp = `${yyyy}-${MM}-${dd} ${HH}:${mm}:${ss},${ms}`

    const level = pickRandom(levels)
    const logger = pickRandom(componentLoggers)
    const loggerPadded = logger.padEnd(60)

    let message: string
    if (level === "WARN") {
      message = pickRandom([
        "Slow garbage collection detected: G1 Young Generation GC took 245ms.",
        "Network buffer pool is running low on available buffers.",
        "Checkpoint completion time exceeded threshold: 8500ms > 5000ms.",
        "Task slot request timed out after 30000ms, retrying.",
      ])
    } else if (level === "DEBUG") {
      message = pickRandom([
        "Received heartbeat from TaskManager container_1234567890_0001_01_000001.",
        "Processing watermark W(1706875234000).",
        "Buffer pool usage: 847/1024 buffers.",
        "RocksDB compaction completed in 124ms.",
      ])
    } else {
      message = pickRandom([
        "Successfully completed checkpoint 42 in 2345ms.",
        "Registering TaskManager with ResourceID container_1234567890_0001_01_000001.",
        "Job ClickCountJob switched from RUNNING to RUNNING.",
        "Checkpoint storage: received acknowledgement for checkpoint 42 from task Source: KafkaSource (1/4).",
        "Connected to ResourceManager at flink-jobmanager:6123.",
        "Starting task Source: KafkaSource (1/4) in thread Thread-12.",
        "Allocated 4 network buffers for output gate.",
        "State backend initialized with RocksDB at /tmp/flink-rocksdb/job_001.",
        "Received JobGraph submission 'FraudDetectionPipeline'.",
        "Deployed task Aggregate (2/4) to slot container_1234567890_0001_01_000002.",
      ])
    }

    lines.push(`${timestamp} ${level.padEnd(5)} ${loggerPadded} - ${message}`)
  }

  return lines.join("\n")
}

export function generateJobManagerInfo(): JobManagerInfo {
  return {
    config: FLINK_CONFIG,
    metrics: generateJmMetrics(),
    logs: generateJmLogs(),
    stdout: generateJmStdout(),
    jvm: generateJvmInfo(),
    classpath: generateClasspath(),
    logFiles: generateLogFiles(),
    threadDump: generateThreadDump(),
  }
}

// ---------------------------------------------------------------------------
// 2.5b — generateThreadDump
// ---------------------------------------------------------------------------

function threadToStringifiedInfo(t: ThreadDumpEntry): string {
  const nativeSuffix = t.isNative ? " (in native)" : ""
  const onLock = t.lockObject ? ` on ${t.lockObject}` : ""
  const header = `"${t.name}" Id=${t.id} ${t.state}${nativeSuffix}${onLock}`

  const lines = [header]
  for (const frame of t.stackFrames) {
    lines.push(`\t${frame}`)
  }
  if (t.lockedSynchronizers.length > 0) {
    lines.push("")
    lines.push(
      `\tNumber of locked synchronizers = ${t.lockedSynchronizers.length}`,
    )
    for (const sync of t.lockedSynchronizers) {
      lines.push(`\t- ${sync}`)
    }
  }
  return lines.join("\n")
}

function generateThreadDump(): ThreadDumpInfo {
  const threads: ThreadDumpEntry[] = [
    // --- main thread ---
    {
      name: "main",
      id: 1,
      state: "WAITING",
      lockObject: "java.util.concurrent.CompletableFuture$Signaller@68cd5176",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.CompletableFuture$Signaller@68cd5176",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:221)",
        "at java.base@21.0.9/java.util.concurrent.CompletableFuture$Signaller.block(CompletableFuture.java:1864)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3780)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3725)",
        "at java.base@21.0.9/java.util.concurrent.CompletableFuture.waitingGet(CompletableFuture.java:1898)",
        "at java.base@21.0.9/java.util.concurrent.CompletableFuture.get(CompletableFuture.java:2072)",
        "at app//org.apache.flink.runtime.entrypoint.ClusterEntrypoint.runClusterEntrypoint(ClusterEntrypoint.java:733)",
        "at app//org.apache.flink.runtime.entrypoint.StandaloneSessionClusterEntrypoint.main(StandaloneSessionClusterEntrypoint.java:59)",
      ],
      lockedSynchronizers: [],
    },
    // --- JVM internal threads ---
    {
      name: "Reference Handler",
      id: 9,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.ref.Reference.waitForReferencePendingList(Native Method)",
        "at java.base@21.0.9/java.lang.ref.Reference.processPendingReferences(Reference.java:246)",
        "at java.base@21.0.9/java.lang.ref.Reference$ReferenceHandler.run(Reference.java:208)",
      ],
      lockedSynchronizers: [],
    },
    {
      name: "Finalizer",
      id: 10,
      state: "WAITING",
      lockObject: "java.lang.ref.NativeReferenceQueue$Lock@1d758edf",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.Object.wait0(Native Method)",
        "-  waiting on java.lang.ref.NativeReferenceQueue$Lock@1d758edf",
        "at java.base@21.0.9/java.lang.Object.wait(Object.java:366)",
        "at java.base@21.0.9/java.lang.Object.wait(Object.java:339)",
        "at java.base@21.0.9/java.lang.ref.NativeReferenceQueue.await(NativeReferenceQueue.java:48)",
        "at java.base@21.0.9/java.lang.ref.ReferenceQueue.remove0(ReferenceQueue.java:158)",
        "at java.base@21.0.9/java.lang.ref.NativeReferenceQueue.remove(NativeReferenceQueue.java:89)",
        "at java.base@21.0.9/java.lang.ref.Finalizer$FinalizerThread.run(Finalizer.java:173)",
      ],
      lockedSynchronizers: [],
    },
    {
      name: "Signal Dispatcher",
      id: 11,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [],
      lockedSynchronizers: [],
    },
    {
      name: "Notification Thread",
      id: 18,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [],
      lockedSynchronizers: [],
    },
    {
      name: "Common-Cleaner",
      id: 19,
      state: "TIMED_WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@65236733",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@65236733",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:269)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1886)",
        "at java.base@21.0.9/java.lang.ref.ReferenceQueue.await(ReferenceQueue.java:71)",
        "at java.base@21.0.9/java.lang.ref.ReferenceQueue.remove0(ReferenceQueue.java:143)",
        "at java.base@21.0.9/java.lang.ref.ReferenceQueue.remove(ReferenceQueue.java:218)",
        "at java.base@21.0.9/jdk.internal.ref.CleanerImpl.run(CleanerImpl.java:140)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
        "at java.base@21.0.9/jdk.internal.misc.InnocuousThread.run(InnocuousThread.java:186)",
      ],
      lockedSynchronizers: [],
    },
    // --- Log4j threads ---
    {
      name: "Log4j2-TF-3-Scheduled-1",
      id: 21,
      state: "TIMED_WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@4789e64",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@4789e64",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:269)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:1797)",
        "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1182)",
        "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:899)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Flink scheduler ---
    {
      name: "flink-scheduler-1",
      id: 34,
      state: "TIMED_WAITING",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.Thread.sleep0(Native Method)",
        "at java.base@21.0.9/java.lang.Thread.sleep(Thread.java:509)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler.waitNanos(LightArrayRevolverScheduler.scala:121)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler$anon$3.nextTick(LightArrayRevolverScheduler.scala:314)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler$anon$3.run(LightArrayRevolverScheduler.scala:284)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Pekko actor dispatchers ---
    ...([5, 11, 12] as const).map(
      (n): ThreadDumpEntry => ({
        name: `flink-pekko.actor.default-dispatcher-${n}`,
        id: 34 + n,
        state: "WAITING",
        lockObject: "org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@378e5c02",
        isNative: false,
        stackFrames: [
          "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
          "-  waiting on org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@378e5c02",
          "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:371)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.awaitWork(ForkJoinPool.java:1893)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:1809)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:188)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Pekko remote dispatchers ---
    ...([6, 7, 14, 15, 16, 17] as const).map(
      (n, i): ThreadDumpEntry => ({
        name: `flink-pekko.remote.default-remote-dispatcher-${n}`,
        id: 40 + i,
        state: i === 3 ? "TIMED_WAITING" : "WAITING",
        lockObject: "org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@496aaf3f",
        isNative: false,
        stackFrames: [
          "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
          "-  waiting on org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@496aaf3f",
          i === 3
            ? "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkUntil(LockSupport.java:449)"
            : "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:371)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.awaitWork(ForkJoinPool.java:1893)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:1809)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:188)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Flink Netty event loops ---
    ...([8, 13] as const).map(
      (n): ThreadDumpEntry => ({
        name: `flink-${n}`,
        id: 43 + (n - 8),
        state: "RUNNABLE",
        lockObject: null,
        isNative: true,
        stackFrames: [
          "at java.base@21.0.9/sun.nio.ch.KQueue.poll(Native Method)",
          "at java.base@21.0.9/sun.nio.ch.KQueueSelectorImpl.doSelect(KQueueSelectorImpl.java:125)",
          "at java.base@21.0.9/sun.nio.ch.SelectorImpl.lockAndDoSelect(SelectorImpl.java:130)",
          `-  locked org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySet@${hex(8)}`,
          `-  locked sun.nio.ch.KQueueSelectorImpl@${hex(8)}`,
          "at java.base@21.0.9/sun.nio.ch.SelectorImpl.select(SelectorImpl.java:147)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySetSelector.select(SelectedSelectionKeySetSelector.java:68)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.select(NioEventLoop.java:879)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.run(NioEventLoop.java:526)",
          "at app//org.apache.flink.shaded.netty4.io.netty.util.concurrent.SingleThreadEventExecutor$4.run(SingleThreadEventExecutor.java:997)",
          "at app//org.apache.flink.shaded.netty4.io.netty.util.internal.ThreadExecutorMap$2.run(ThreadExecutorMap.java:74)",
          "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
          "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Timer ---
    {
      name: "Timer-0",
      id: 47,
      state: "TIMED_WAITING",
      lockObject: "java.util.TaskQueue@2b9a13c1",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.Object.wait0(Native Method)",
        "-  waiting on java.util.TaskQueue@2b9a13c1",
        "at java.base@21.0.9/java.lang.Object.wait(Object.java:366)",
        "at java.base@21.0.9/java.util.TimerThread.mainLoop(Timer.java:563)",
        "at java.base@21.0.9/java.util.TimerThread.run(Timer.java:516)",
      ],
      lockedSynchronizers: [],
    },
    // --- BLOB server (with locked synchronizers) ---
    {
      name: "BLOB Server listener at 57383",
      id: 46,
      state: "RUNNABLE",
      lockObject: null,
      isNative: true,
      stackFrames: [
        "at java.base@21.0.9/sun.nio.ch.Net.accept(Native Method)",
        "at java.base@21.0.9/sun.nio.ch.NioSocketImpl.accept(NioSocketImpl.java:748)",
        "at java.base@21.0.9/java.net.ServerSocket.implAccept(ServerSocket.java:698)",
        "at java.base@21.0.9/java.net.ServerSocket.platformImplAccept(ServerSocket.java:663)",
        "at java.base@21.0.9/java.net.ServerSocket.implAccept(ServerSocket.java:639)",
        "at java.base@21.0.9/java.net.ServerSocket.implAccept(ServerSocket.java:585)",
        "at java.base@21.0.9/java.net.ServerSocket.accept(ServerSocket.java:543)",
        "at app//org.apache.flink.util.NetUtils.acceptWithoutTimeout(NetUtils.java:172)",
        "at app//org.apache.flink.runtime.blob.BlobServer.run(BlobServer.java:317)",
      ],
      lockedSynchronizers: [
        "java.util.concurrent.locks.ReentrantLock$NonfairSync@379552da",
      ],
    },
    // --- Metrics scheduler ---
    {
      name: "flink-metrics-scheduler-1",
      id: 49,
      state: "TIMED_WAITING",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/java.lang.Thread.sleep0(Native Method)",
        "at java.base@21.0.9/java.lang.Thread.sleep(Thread.java:509)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler.waitNanos(LightArrayRevolverScheduler.scala:121)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler$anon$3.nextTick(LightArrayRevolverScheduler.scala:314)",
        "at org.apache.pekko.actor.LightArrayRevolverScheduler$anon$3.run(LightArrayRevolverScheduler.scala:284)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Metrics remote dispatchers ---
    ...([6, 7, 8, 11, 12, 13, 15, 18] as const).map(
      (n, i): ThreadDumpEntry => ({
        name: `flink-metrics-pekko.remote.default-remote-dispatcher-${n}`,
        id: 54 + i,
        state: i === 1 ? "TIMED_WAITING" : "WAITING",
        lockObject: "org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@32af3833",
        isNative: false,
        stackFrames: [
          "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
          "-  waiting on org.apache.pekko.dispatch.PekkoJdk9ForkJoinPool@32af3833",
          i === 1
            ? "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkUntil(LockSupport.java:449)"
            : "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:371)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.awaitWork(ForkJoinPool.java:1893)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:1809)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:188)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Metrics netty event loop ---
    {
      name: "flink-metrics-9",
      id: 57,
      state: "RUNNABLE",
      lockObject: null,
      isNative: true,
      stackFrames: [
        "at java.base@21.0.9/sun.nio.ch.KQueue.poll(Native Method)",
        "at java.base@21.0.9/sun.nio.ch.KQueueSelectorImpl.doSelect(KQueueSelectorImpl.java:125)",
        "at java.base@21.0.9/sun.nio.ch.SelectorImpl.lockAndDoSelect(SelectorImpl.java:130)",
        `-  locked org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySet@${hex(8)}`,
        `-  locked sun.nio.ch.KQueueSelectorImpl@${hex(8)}`,
        "at java.base@21.0.9/sun.nio.ch.SelectorImpl.select(SelectorImpl.java:147)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySetSelector.select(SelectedSelectionKeySetSelector.java:68)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.select(NioEventLoop.java:879)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.run(NioEventLoop.java:526)",
        "at app//org.apache.flink.shaded.netty4.io.netty.util.concurrent.SingleThreadEventExecutor$4.run(SingleThreadEventExecutor.java:997)",
        "at app//org.apache.flink.shaded.netty4.io.netty.util.internal.ThreadExecutorMap$2.run(ThreadExecutorMap.java:74)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Metric View Updater ---
    {
      name: "Flink-Metric-View-Updater-thread-1",
      id: 60,
      state: "TIMED_WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@33fa98b6",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@33fa98b6",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:269)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:1797)",
        "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1182)",
        "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:899)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- REST server boss ---
    {
      name: "flink-rest-server-netty-boss-thread-1",
      id: 61,
      state: "RUNNABLE",
      lockObject: null,
      isNative: true,
      stackFrames: [
        "at java.base@21.0.9/sun.nio.ch.KQueue.poll(Native Method)",
        "at java.base@21.0.9/sun.nio.ch.KQueueSelectorImpl.doSelect(KQueueSelectorImpl.java:125)",
        "at java.base@21.0.9/sun.nio.ch.SelectorImpl.lockAndDoSelect(SelectorImpl.java:130)",
        `-  locked org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySet@${hex(8)}`,
        `-  locked sun.nio.ch.KQueueSelectorImpl@${hex(8)}`,
        "at java.base@21.0.9/sun.nio.ch.SelectorImpl.select(SelectorImpl.java:147)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySetSelector.select(SelectedSelectionKeySetSelector.java:68)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.select(NioEventLoop.java:879)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.run(NioEventLoop.java:526)",
        "at app//org.apache.flink.shaded.netty4.io.netty.util.concurrent.SingleThreadEventExecutor$4.run(SingleThreadEventExecutor.java:997)",
        "at app//org.apache.flink.shaded.netty4.io.netty.util.internal.ThreadExecutorMap$2.run(ThreadExecutorMap.java:74)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- Dispatcher REST endpoint thread pool ---
    ...([1, 2, 3, 4] as const).map(
      (n, i): ThreadDumpEntry => ({
        name: `Flink-DispatcherRestEndpoint-thread-${n}`,
        id: 62 + i,
        state: i === 1 ? "TIMED_WAITING" : "WAITING",
        lockObject:
          "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@7b88d8d5",
        isNative: false,
        stackFrames: [
          "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
          "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@7b88d8d5",
          i === 1
            ? "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:269)"
            : "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:371)",
          i === 1
            ? "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:1797)"
            : "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:519)",
          ...(i === 1
            ? []
            : [
                "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3780)",
                "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3725)",
                "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1746)",
              ]),
          "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1182)",
          "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:899)",
          "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
          "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
          "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
          "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
          "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Cluster IO threads ---
    ...([1, 2, 3] as const).map(
      (n): ThreadDumpEntry => ({
        name: `cluster-io-thread-${n}`,
        id: 63 + n * 2,
        state: "WAITING",
        lockObject:
          "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@1cd0c03a",
        isNative: false,
        stackFrames: [
          "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
          "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@1cd0c03a",
          "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:371)",
          "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:519)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3780)",
          "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3725)",
          "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1746)",
          "at java.base@21.0.9/java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:435)",
          "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
          "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
          "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
          "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
          "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Thread pool worker ---
    {
      name: "pool-2-thread-1",
      id: 64,
      state: "WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@1e0f0e6a",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@1e0f0e6a",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.park(LockSupport.java:371)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionNode.block(AbstractQueuedSynchronizer.java:519)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.unmanagedBlock(ForkJoinPool.java:3780)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.managedBlock(ForkJoinPool.java:3725)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.await(AbstractQueuedSynchronizer.java:1746)",
        "at java.base@21.0.9/java.util.concurrent.LinkedBlockingQueue.take(LinkedBlockingQueue.java:435)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- ResourceManager scheduler ---
    {
      name: "resourcemanager_1-main-scheduler-thread-1",
      id: 66,
      state: "TIMED_WAITING",
      lockObject:
        "java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@71996377",
      isNative: false,
      stackFrames: [
        "at java.base@21.0.9/jdk.internal.misc.Unsafe.park(Native Method)",
        "-  waiting on java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject@71996377",
        "at java.base@21.0.9/java.util.concurrent.locks.LockSupport.parkNanos(LockSupport.java:269)",
        "at java.base@21.0.9/java.util.concurrent.locks.AbstractQueuedSynchronizer$ConditionObject.awaitNanos(AbstractQueuedSynchronizer.java:1797)",
        "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:1182)",
        "at java.base@21.0.9/java.util.concurrent.ScheduledThreadPoolExecutor$DelayedWorkQueue.take(ScheduledThreadPoolExecutor.java:899)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.getTask(ThreadPoolExecutor.java:1070)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor.runWorker(ThreadPoolExecutor.java:1130)",
        "at java.base@21.0.9/java.util.concurrent.ThreadPoolExecutor$Worker.run(ThreadPoolExecutor.java:642)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- REST server worker threads ---
    ...Array.from(
      { length: 20 },
      (_, i): ThreadDumpEntry => ({
        name: `flink-rest-server-netty-worker-thread-${i + 1}`,
        id: 73 + i,
        state: "RUNNABLE",
        lockObject: null,
        isNative: true,
        stackFrames: [
          "at java.base@21.0.9/sun.nio.ch.KQueue.poll(Native Method)",
          "at java.base@21.0.9/sun.nio.ch.KQueueSelectorImpl.doSelect(KQueueSelectorImpl.java:125)",
          "at java.base@21.0.9/sun.nio.ch.SelectorImpl.lockAndDoSelect(SelectorImpl.java:130)",
          `-  locked org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySet@${hex(8)}`,
          `-  locked sun.nio.ch.KQueueSelectorImpl@${hex(8)}`,
          "at java.base@21.0.9/sun.nio.ch.SelectorImpl.select(SelectorImpl.java:147)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySetSelector.select(SelectedSelectionKeySetSelector.java:68)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.select(NioEventLoop.java:879)",
          "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.run(NioEventLoop.java:526)",
          "at app//org.apache.flink.shaded.netty4.io.netty.util.concurrent.SingleThreadEventExecutor$4.run(SingleThreadEventExecutor.java:997)",
          "at app//org.apache.flink.shaded.netty4.io.netty.util.internal.ThreadExecutorMap$2.run(ThreadExecutorMap.java:74)",
          "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
          "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
        ],
        lockedSynchronizers: [],
      }),
    ),
    // --- Metrics netty event loop 2 ---
    {
      name: "flink-metrics-14",
      id: 81,
      state: "RUNNABLE",
      lockObject: null,
      isNative: true,
      stackFrames: [
        "at java.base@21.0.9/sun.nio.ch.KQueue.poll(Native Method)",
        "at java.base@21.0.9/sun.nio.ch.KQueueSelectorImpl.doSelect(KQueueSelectorImpl.java:125)",
        "at java.base@21.0.9/sun.nio.ch.SelectorImpl.lockAndDoSelect(SelectorImpl.java:130)",
        `-  locked org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySet@${hex(8)}`,
        `-  locked sun.nio.ch.KQueueSelectorImpl@${hex(8)}`,
        "at java.base@21.0.9/sun.nio.ch.SelectorImpl.select(SelectorImpl.java:147)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.SelectedSelectionKeySetSelector.select(SelectedSelectionKeySetSelector.java:68)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.select(NioEventLoop.java:879)",
        "at app//org.apache.flink.shaded.netty4.io.netty.channel.nio.NioEventLoop.run(NioEventLoop.java:526)",
        "at app//org.apache.flink.shaded.netty4.io.netty.util.concurrent.SingleThreadEventExecutor$4.run(SingleThreadEventExecutor.java:997)",
        "at app//org.apache.flink.shaded.netty4.io.netty.util.internal.ThreadExecutorMap$2.run(ThreadExecutorMap.java:74)",
        "at java.base@21.0.9/java.lang.Thread.runWith(Thread.java:1596)",
        "at java.base@21.0.9/java.lang.Thread.run(Thread.java:1583)",
      ],
      lockedSynchronizers: [],
    },
    // --- The active thread taking the dump ---
    {
      name: "flink-pekko.actor.default-dispatcher-18",
      id: 102,
      state: "RUNNABLE",
      lockObject: null,
      isNative: false,
      stackFrames: [
        "at java.management@21.0.9/sun.management.ThreadImpl.dumpThreads0(Native Method)",
        "at java.management@21.0.9/sun.management.ThreadImpl.dumpAllThreads(ThreadImpl.java:518)",
        "at java.management@21.0.9/sun.management.ThreadImpl.dumpAllThreads(ThreadImpl.java:506)",
        "at app//org.apache.flink.runtime.util.JvmUtils.createThreadDump(JvmUtils.java:50)",
        "at app//org.apache.flink.runtime.rest.messages.ThreadDumpInfo.dumpAndCreate(ThreadDumpInfo.java:59)",
        "at app//org.apache.flink.runtime.dispatcher.Dispatcher.requestThreadDump(Dispatcher.java:982)",
        "at java.base@21.0.9/java.lang.invoke.LambdaForm$DMH/0x0000009801198000.invokeVirtual(LambdaForm$DMH)",
        "at java.base@21.0.9/java.lang.invoke.LambdaForm$MH/0x00000098012b4400.invoke(LambdaForm$MH)",
        "at java.base@21.0.9/java.lang.invoke.Invokers$Holder.invokeExact_MT(Invokers$Holder)",
        "at java.base@21.0.9/jdk.internal.reflect.DirectMethodHandleAccessor.invokeImpl(DirectMethodHandleAccessor.java:154)",
        "at java.base@21.0.9/jdk.internal.reflect.DirectMethodHandleAccessor.invoke(DirectMethodHandleAccessor.java:103)",
        "at java.base@21.0.9/java.lang.reflect.Method.invoke(Method.java:580)",
        "at org.apache.flink.runtime.rpc.pekko.PekkoRpcActor.lambda$handleRpcInvocation$1(PekkoRpcActor.java:318)",
        "at app//org.apache.flink.runtime.concurrent.ClassLoadingUtils.runWithContextClassLoader(ClassLoadingUtils.java:83)",
        "at org.apache.flink.runtime.rpc.pekko.PekkoRpcActor.handleRpcInvocation(PekkoRpcActor.java:316)",
        "at org.apache.flink.runtime.rpc.pekko.PekkoRpcActor.handleRpcMessage(PekkoRpcActor.java:229)",
        "at org.apache.flink.runtime.rpc.pekko.FencedPekkoRpcActor.handleRpcMessage(FencedPekkoRpcActor.java:88)",
        "at org.apache.flink.runtime.rpc.pekko.PekkoRpcActor.handleMessage(PekkoRpcActor.java:174)",
        "at org.apache.pekko.japi.pf.UnitCaseStatement.apply(CaseStatements.scala:33)",
        "at org.apache.pekko.japi.pf.UnitCaseStatement.apply(CaseStatements.scala:29)",
        "at scala.PartialFunction.applyOrElse(PartialFunction.scala:127)",
        "at scala.PartialFunction.applyOrElse$(PartialFunction.scala:126)",
        "at org.apache.pekko.japi.pf.UnitCaseStatement.applyOrElse(CaseStatements.scala:29)",
        "at scala.PartialFunction$OrElse.applyOrElse(PartialFunction.scala:175)",
        "at scala.PartialFunction$OrElse.applyOrElse(PartialFunction.scala:176)",
        "at scala.PartialFunction$OrElse.applyOrElse(PartialFunction.scala:176)",
        "at org.apache.pekko.actor.Actor.aroundReceive(Actor.scala:547)",
        "at org.apache.pekko.actor.Actor.aroundReceive$(Actor.scala:545)",
        "at org.apache.pekko.actor.AbstractActor.aroundReceive(AbstractActor.scala:229)",
        "at org.apache.pekko.actor.ActorCell.receiveMessage(ActorCell.scala:590)",
        "at org.apache.pekko.actor.ActorCell.invoke(ActorCell.scala:557)",
        "at org.apache.pekko.dispatch.Mailbox.processMailbox(Mailbox.scala:272)",
        "at org.apache.pekko.dispatch.Mailbox.run(Mailbox.scala:233)",
        "at org.apache.pekko.dispatch.Mailbox.exec(Mailbox.scala:245)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinTask.doExec(ForkJoinTask.java:387)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool$WorkQueue.topLevelExec(ForkJoinPool.java:1312)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.scan(ForkJoinPool.java:1843)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:1808)",
        "at java.base@21.0.9/java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:188)",
      ],
      lockedSynchronizers: [],
    },
  ]

  const threadInfos: ThreadInfoRaw[] = threads.map((t) => ({
    threadName: t.name,
    stringifiedThreadInfo: threadToStringifiedInfo(t),
  }))
  return { threadInfos }
}

function generateJmMetrics(): JobManagerMetrics {
  return {
    jvmHeapUsed: generateJmMetricSeries(600 * MB, 0.15, 30),
    jvmHeapMax: 1024 * MB,
    jvmNonHeapUsed: generateJmMetricSeries(120 * MB, 0.1, 30),
    jvmNonHeapMax: 256 * MB,
    threadCount: generateJmMetricSeries(45, 0.1, 30),
    gcCount: generateJmMetricSeries(80, 0.05, 30),
    gcTime: generateJmMetricSeries(2200, 0.08, 30),
  }
}

function generateJmLogs(): string {
  const lines = [
    "2025-01-15 10:00:01,234 INFO  org.apache.flink.runtime.entrypoint.ClusterEntrypoint        - Starting StandaloneSessionClusterEntrypoint.",
    "2025-01-15 10:00:01,567 INFO  org.apache.flink.runtime.entrypoint.ClusterEntrypoint        - Loaded configuration: {jobmanager.rpc.address=flink-jobmanager, rest.port=8081}",
    "2025-01-15 10:00:02,012 INFO  org.apache.flink.runtime.blob.BlobServer                     - Started BLOB server at 0.0.0.0:6124 - max concurrent requests: 50",
    "2025-01-15 10:00:02,345 INFO  org.apache.flink.runtime.dispatcher.DispatcherRestEndpoint    - Rest endpoint listening at flink-jobmanager:8081",
    "2025-01-15 10:00:02,678 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager - ResourceManager akka.tcp://flink@flink-jobmanager:6123/user/rpc/resourcemanager_0 was granted leadership.",
    "2025-01-15 10:00:03,001 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher      - Dispatcher akka.tcp://flink@flink-jobmanager:6123/user/rpc/dispatcher was granted leadership.",
    "2025-01-15 10:00:05,234 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager - Registering TaskManager with ResourceID container_1234567890_0001_01_000001 at ResourceManager.",
    "2025-01-15 10:00:05,567 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager - Registering TaskManager with ResourceID container_1234567890_0001_01_000002 at ResourceManager.",
    "2025-01-15 10:00:05,890 INFO  org.apache.flink.runtime.resourcemanager.StandaloneResourceManager - Registering TaskManager with ResourceID container_1234567890_0001_01_000003 at ResourceManager.",
    "2025-01-15 10:00:10,123 INFO  org.apache.flink.runtime.dispatcher.StandaloneDispatcher      - Received JobGraph submission 'ClickCountJob' (a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6).",
    "2025-01-15 10:00:10,456 INFO  org.apache.flink.runtime.jobmaster.JobMaster                  - Initializing job 'ClickCountJob' (a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6).",
    "2025-01-15 10:00:10,789 INFO  org.apache.flink.runtime.jobmaster.JobMaster                  - Using restart strategy FixedDelayRestartStrategy(maxNumberRestartAttempts=3, delayBetweenRestartAttempts=10000).",
    "2025-01-15 10:00:11,012 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph         - Job ClickCountJob (a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6) switched from state CREATED to RUNNING.",
  ]
  return lines.join("\n")
}

function generateJmStdout(): string {
  return [
    "Starting Flink JobManager (StandaloneSessionClusterEntrypoint)",
    "  JVM version: 11.0.21+9",
    "  Max heap size: 1024 MB",
    "  JVM args: -Xmx1024m -Xms1024m -XX:MaxMetaspaceSize=256m",
    "  Classpath: /opt/flink/lib/*",
    "  Working directory: /opt/flink",
    "",
    "Flink version: 1.20.0",
    "Scala version: 2.12",
    "Build date: 2025-01-10T08:30:00Z",
    "Commit: a1b2c3d",
  ].join("\n")
}

// ---------------------------------------------------------------------------
// 2.6 — generateUploadedJars
// ---------------------------------------------------------------------------

export function generateUploadedJars(): UploadedJar[] {
  return [
    {
      id: hex(16),
      name: "click-count-job-1.0.jar",
      uploadTime: hoursAgo(24),
      entryClasses: [
        "com.example.ClickCountJob",
        "com.example.SessionWindowJob",
      ],
    },
    {
      id: hex(16),
      name: "fraud-detection-2.3.jar",
      uploadTime: hoursAgo(6),
      entryClasses: [
        "com.example.fraud.FraudDetectionPipeline",
        "com.example.fraud.RuleEngineJob",
        "com.example.fraud.AlertDispatcher",
      ],
    },
    {
      id: hex(16),
      name: "etl-daily-aggregation-1.1.jar",
      uploadTime: hoursAgo(2),
      entryClasses: ["com.example.etl.DailyAggregationJob"],
    },
  ]
}

// ---------------------------------------------------------------------------
// 2.7 — refreshMetrics (mutates in place for performance)
// ---------------------------------------------------------------------------

export function refreshMetrics(
  tms: TaskManager[],
  jm: JobManagerInfo,
  runningJobs: FlinkJob[],
): void {
  const now = new Date()

  // Update TM metrics with small deltas
  for (const tm of tms) {
    const m = tm.metrics
    m.cpuUsage = Math.max(0, Math.min(100, jitter(m.cpuUsage, 0.05)))
    m.heapUsed = Math.max(0, Math.min(m.heapMax, jitter(m.heapUsed, 0.03)))
    m.nonHeapUsed = Math.max(
      0,
      Math.min(m.nonHeapMax, jitter(m.nonHeapUsed, 0.02)),
    )
    m.managedMemoryUsed = Math.max(
      0,
      Math.min(m.managedMemoryTotal, jitter(m.managedMemoryUsed, 0.02)),
    )
    m.nettyShuffleMemoryUsed = Math.max(
      0,
      Math.min(
        m.nettyShuffleMemoryTotal,
        jitter(m.nettyShuffleMemoryUsed, 0.04),
      ),
    )
    m.nettyShuffleMemoryAvailable =
      m.nettyShuffleMemoryTotal - m.nettyShuffleMemoryUsed
    m.directUsed = Math.max(
      0,
      Math.min(m.directMax, jitter(m.directUsed, 0.03)),
    )
    m.metaspaceUsed = Math.max(
      0,
      Math.min(m.metaspaceMax, jitter(m.metaspaceUsed, 0.02)),
    )
    m.threadCount = Math.max(10, Math.round(jitter(m.threadCount, 0.03)))
    // Increment GC counters occasionally
    for (const gc of m.garbageCollectors) {
      if (Math.random() < 0.3) {
        gc.count += 1
        gc.time += Math.floor(Math.random() * 50)
      }
    }
    tm.lastHeartbeat = now
  }

  // Append a new data point to JM time-series, dropping the oldest
  const jmm = jm.metrics
  const pushSample = (
    series: JvmMetricSample[],
    base: number,
    variance: number,
  ) => {
    series.push({ timestamp: now, value: jitter(base, variance) })
    if (series.length > 30) series.shift()
  }

  pushSample(jmm.jvmHeapUsed, 600 * MB, 0.15)
  pushSample(jmm.jvmNonHeapUsed, 120 * MB, 0.1)
  pushSample(jmm.threadCount, 45, 0.1)
  pushSample(
    jmm.gcCount,
    jmm.gcCount[jmm.gcCount.length - 1]?.value ?? 80,
    0.02,
  )
  pushSample(jmm.gcTime, jmm.gcTime[jmm.gcTime.length - 1]?.value ?? 2200, 0.02)

  // Update running job durations
  for (const job of runningJobs) {
    job.duration = Date.now() - job.startTime.getTime()
  }
}
