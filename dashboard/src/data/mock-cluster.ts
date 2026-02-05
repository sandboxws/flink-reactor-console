import type {
  Checkpoint,
  CheckpointConfig,
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
  JvmMetricSample,
  ShipStrategy,
  SubtaskMetrics,
  TaskCounts,
  TaskManager,
  TaskManagerMetrics,
  UploadedJar,
} from "./cluster-types";
import { PLACEHOLDER_VALUES, pickRandom, TASK_MANAGERS } from "./flink-loggers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hex(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += Math.floor(Math.random() * 16).toString(16);
  }
  return out;
}

function minutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60_000);
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

function jitter(base: number, pct: number): number {
  const delta = base * pct;
  return base + (Math.random() * 2 - 1) * delta;
}

const GB = 1024 ** 3;
const MB = 1024 ** 2;

// ---------------------------------------------------------------------------
// Job names (reuse PLACEHOLDER_VALUES for cross-page consistency)
// ---------------------------------------------------------------------------

const JOB_NAMES = PLACEHOLDER_VALUES.JOB_NAME;

const EXTRA_JOB_NAMES = [
  "UserSessionAggregation",
  "PageViewCounter",
  "RealTimeInventorySync",
  "PaymentReconciliation",
  "LogAnomalyDetector",
  "ClickstreamEnrichment",
  "SensorDataIngestion",
  "NotificationDispatcher",
];

const ALL_JOB_NAMES = [...JOB_NAMES, ...EXTRA_JOB_NAMES];

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
  };

  if (status === "FINISHED") {
    counts.finished = parallelism;
  } else if (status === "FAILED") {
    counts.failed = Math.ceil(parallelism * 0.25);
    counts.finished = parallelism - counts.failed;
  } else if (status === "CANCELED" || status === "CANCELLING") {
    counts.canceling = Math.ceil(parallelism * 0.3);
    counts.finished = parallelism - counts.canceling;
  } else if (status === "RUNNING") {
    // Mostly running with a few finished
    const finished = Math.floor(Math.random() * Math.ceil(parallelism * 0.3));
    const pending = Math.random() < 0.2 ? 1 : 0;
    counts.finished = finished;
    counts.pending = pending;
    counts.running = parallelism - finished - pending;
  } else {
    counts.pending = parallelism;
  }

  return counts;
}

// ---------------------------------------------------------------------------
// Job detail generators
// ---------------------------------------------------------------------------

const OPERATOR_TEMPLATES: { name: string; type: "source" | "transform" | "sink" }[] = [
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
];

const SHIP_STRATEGIES: ShipStrategy[] = [
  "FORWARD",
  "HASH",
  "REBALANCE",
  "BROADCAST",
  "RESCALE",
];

function vertexStatusFromJob(jobStatus: JobStatus): JobVertexStatus {
  if (jobStatus === "RUNNING") return "RUNNING";
  if (jobStatus === "FINISHED") return "FINISHED";
  if (jobStatus === "FAILED") return "FAILED";
  if (jobStatus === "CANCELED" || jobStatus === "CANCELLING") return "CANCELED";
  return "CREATED";
}

export function generateJobPlan(
  parallelism: number,
  jobStatus: JobStatus,
  jobStartTime: Date,
): JobPlan {
  // Create a realistic 4-6 vertex DAG
  const vertexCount = 4 + Math.floor(Math.random() * 3);
  const vertices: JobVertex[] = [];
  const edges: JobEdge[] = [];

  // Pick operators: source(s) → transforms → sink(s)
  const sources = OPERATOR_TEMPLATES.filter((o) => o.type === "source");
  const transforms = OPERATOR_TEMPLATES.filter((o) => o.type === "transform");
  const sinks = OPERATOR_TEMPLATES.filter((o) => o.type === "sink");

  const pipeline: string[] = [];
  pipeline.push(pickRandom(sources).name);
  const transformCount = Math.max(1, vertexCount - 2);
  const usedTransforms = new Set<string>();
  for (let i = 0; i < transformCount; i++) {
    let t: string;
    do {
      t = pickRandom(transforms).name;
    } while (usedTransforms.has(t) && usedTransforms.size < transforms.length);
    usedTransforms.add(t);
    pipeline.push(t);
  }
  pipeline.push(pickRandom(sinks).name);

  const jobStartMs = jobStartTime.getTime();
  const baseStatus = vertexStatusFromJob(jobStatus);

  for (let i = 0; i < pipeline.length; i++) {
    const id = hex(32);
    const vertexPar = i === 0 ? parallelism : pickRandom([parallelism, parallelism, Math.max(1, parallelism / 2)]);
    const baseRecords = 50_000 + Math.floor(Math.random() * 2_000_000);
    const busyTime = Math.floor(Math.random() * 900);
    const vertexStartOffset = i * (2000 + Math.floor(Math.random() * 3000));

    // For failed jobs, make the last transform vertex failed
    let vStatus = baseStatus;
    if (jobStatus === "FAILED" && i === pipeline.length - 2) {
      vStatus = "FAILED";
    } else if (jobStatus === "FAILED" && i === pipeline.length - 1) {
      vStatus = "CANCELED";
    }

    vertices.push({
      id,
      name: pipeline[i],
      parallelism: vertexPar,
      status: vStatus,
      metrics: {
        recordsIn: i === 0 ? 0 : baseRecords,
        recordsOut: i === pipeline.length - 1 ? 0 : Math.floor(baseRecords * (0.7 + Math.random() * 0.3)),
        bytesIn: i === 0 ? 0 : baseRecords * 256,
        bytesOut: i === pipeline.length - 1 ? 0 : baseRecords * 200,
        busyTimeMsPerSecond: busyTime,
        backPressuredTimeMsPerSecond: Math.max(0, busyTime - 400),
      },
      tasks: generateTaskCounts(vertexPar, vStatus === "RUNNING" ? "RUNNING" : vStatus === "FINISHED" ? "FINISHED" : vStatus === "FAILED" ? "FAILED" : "CANCELED"),
      duration: 10_000 + Math.floor(Math.random() * 300_000),
      startTime: jobStartMs + vertexStartOffset,
    });
  }

  // Create edges (linear chain)
  for (let i = 0; i < vertices.length - 1; i++) {
    edges.push({
      source: vertices[i].id,
      target: vertices[i + 1].id,
      shipStrategy: i === 0 ? "FORWARD" : pickRandom(SHIP_STRATEGIES),
    });
  }

  return { vertices, edges };
}

export function generateJobExceptions(
  jobStatus: JobStatus,
  vertices: JobVertex[],
): JobException[] {
  // Healthy jobs get no exceptions
  if (jobStatus !== "FAILED" && jobStatus !== "FAILING") {
    return [];
  }

  const count = 1 + Math.floor(Math.random() * 3);
  const exceptions: JobException[] = [];
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
      message: "Failed to deserialize record from Kafka: Corrupt message at offset 1542890",
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
      message: "Connection reset by peer: JDBC sink lost connection to database",
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
  ];

  for (let i = 0; i < count; i++) {
    const template = exceptionTemplates[i % exceptionTemplates.length];
    const failedVertex = vertices.find((v) => v.status === "FAILED") ?? pickRandom(vertices);
    const subtaskIdx = Math.floor(Math.random() * failedVertex.parallelism);

    exceptions.push({
      timestamp: new Date(Date.now() - (count - i) * 30_000 - Math.floor(Math.random() * 60_000)),
      name: template.name,
      message: template.message,
      stacktrace: template.trace,
      taskName: failedVertex.name,
      location: `${failedVertex.name} (${subtaskIdx + 1}/${failedVertex.parallelism})`,
    });
  }

  return exceptions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

export function generateCheckpoints(jobStatus: JobStatus): {
  checkpoints: Checkpoint[];
  config: CheckpointConfig;
} {
  const config: CheckpointConfig = {
    mode: "EXACTLY_ONCE",
    interval: pickRandom([30_000, 60_000, 120_000]),
    timeout: 600_000,
    minPause: pickRandom([10_000, 30_000]),
    maxConcurrent: 1,
  };

  const count = 5 + Math.floor(Math.random() * 11); // 5-15
  const checkpoints: Checkpoint[] = [];
  const now = Date.now();

  for (let i = 0; i < count; i++) {
    const triggerOffset = (count - i) * config.interval + Math.floor(Math.random() * 5000);
    const duration = 500 + Math.floor(Math.random() * 9500); // 500ms-10s
    const baseSize = 10 + Math.floor(Math.random() * 490); // 10-500 MB

    checkpoints.push({
      id: i + 1,
      status: "COMPLETED",
      triggerTimestamp: new Date(now - triggerOffset),
      duration,
      size: baseSize * MB,
      processedData: Math.floor(baseSize * MB * (0.8 + Math.random() * 0.4)),
      isSavepoint: i === 0 && Math.random() < 0.2,
    });
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
    });
  }

  return { checkpoints, config };
}

export function generateSubtaskMetrics(
  vertices: JobVertex[],
): Record<string, SubtaskMetrics[]> {
  const result: Record<string, SubtaskMetrics[]> = {};

  for (const vertex of vertices) {
    const subtasks: SubtaskMetrics[] = [];
    const baseRecords = 20_000 + Math.floor(Math.random() * 500_000);
    // Pick one subtask to be skewed (3-5x more records)
    const skewedIdx = Math.floor(Math.random() * vertex.parallelism);
    const skewFactor = 3 + Math.random() * 2;

    for (let i = 0; i < vertex.parallelism; i++) {
      const multiplier = i === skewedIdx ? skewFactor : 0.8 + Math.random() * 0.4;
      const recordsIn = Math.floor(baseRecords * multiplier);
      const recordsOut = Math.floor(recordsIn * (0.7 + Math.random() * 0.3));

      subtasks.push({
        subtaskIndex: i,
        recordsIn,
        recordsOut,
        bytesIn: recordsIn * 256,
        bytesOut: recordsOut * 200,
        busyTimeMsPerSecond: Math.floor(200 + Math.random() * 700),
      });
    }

    result[vertex.id] = subtasks;
  }

  return result;
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
  ];
}

function generateJobDetailFields(
  parallelism: number,
  jobStatus: JobStatus,
  startTime: Date,
): Pick<FlinkJob, "plan" | "exceptions" | "checkpoints" | "checkpointConfig" | "subtaskMetrics" | "configuration"> {
  const plan = generateJobPlan(parallelism, jobStatus, startTime);
  const exceptions = generateJobExceptions(jobStatus, plan.vertices);
  const { checkpoints, config } = generateCheckpoints(jobStatus);
  const subtaskMetrics = generateSubtaskMetrics(plan.vertices);
  const configuration = generateJobConfiguration();

  return {
    plan,
    exceptions,
    checkpoints,
    checkpointConfig: config,
    subtaskMetrics,
    configuration,
  };
}

// ---------------------------------------------------------------------------
// 2.1 — generateClusterOverview
// ---------------------------------------------------------------------------

export function generateClusterOverview(
  running: FlinkJob[],
  completed: FlinkJob[],
  tms: TaskManager[],
): ClusterOverview {
  const finishedCount = completed.filter((j) => j.status === "FINISHED").length;
  const cancelledCount = completed.filter(
    (j) => j.status === "CANCELED",
  ).length;
  const failedCount = completed.filter((j) => j.status === "FAILED").length;

  const totalSlots = tms.reduce((sum, tm) => sum + tm.slotsTotal, 0);
  const freeSlots = tms.reduce((sum, tm) => sum + tm.slotsFree, 0);

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
  };
}

// ---------------------------------------------------------------------------
// 2.2 — generateRunningJobs
// ---------------------------------------------------------------------------

export function generateRunningJobs(): FlinkJob[] {
  const count = 2 + Math.floor(Math.random() * 3); // 2–4
  const used = new Set<string>();
  const jobs: FlinkJob[] = [];

  for (let i = 0; i < count; i++) {
    let name: string;
    do {
      name = pickRandom(ALL_JOB_NAMES);
    } while (used.has(name));
    used.add(name);

    const parallelism = pickRandom([2, 4, 4, 8]);
    const startMin = 5 + Math.floor(Math.random() * 55); // 5–60 min ago
    const startTime = minutesAgo(startMin);

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
    });
  }

  return jobs;
}

// ---------------------------------------------------------------------------
// 2.3 — generateCompletedJobs
// ---------------------------------------------------------------------------

export function generateCompletedJobs(): FlinkJob[] {
  const count = 5 + Math.floor(Math.random() * 6); // 5–10
  const statuses: JobStatus[] = [
    "FINISHED",
    "FINISHED",
    "FINISHED",
    "FINISHED",
    "FINISHED",
    "FAILED",
    "FAILED",
    "CANCELED",
  ];
  const jobs: FlinkJob[] = [];

  for (let i = 0; i < count; i++) {
    const parallelism = pickRandom([2, 4, 4, 8]);
    const status = pickRandom(statuses);
    const startHours = 1 + Math.floor(Math.random() * 48); // 1–48h ago
    const durationMs = (5 + Math.floor(Math.random() * 120)) * 60_000; // 5–125 min
    const startTime = hoursAgo(startHours);
    const endTime = new Date(startTime.getTime() + durationMs);

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
    });
  }

  // Sort by end time descending
  jobs.sort(
    (a, b) => (b.endTime?.getTime() ?? 0) - (a.endTime?.getTime() ?? 0),
  );

  return jobs;
}

// ---------------------------------------------------------------------------
// 2.4 — generateTaskManagers
// ---------------------------------------------------------------------------

function generateTmMetrics(): TaskManagerMetrics {
  const heapMax = 4 * GB;
  const nonHeapMax = 256 * MB;
  const managedTotal = 2 * GB;
  const networkTotal = 512 * MB;

  return {
    cpuUsage: 15 + Math.random() * 60,
    jvmHeapUsed: jitter(heapMax * 0.6, 0.15),
    jvmHeapMax: heapMax,
    jvmNonHeapUsed: jitter(nonHeapMax * 0.5, 0.2),
    jvmNonHeapMax: nonHeapMax,
    managedMemoryUsed: jitter(managedTotal * 0.45, 0.2),
    managedMemoryTotal: managedTotal,
    networkMemoryUsed: jitter(networkTotal * 0.3, 0.25),
    networkMemoryTotal: networkTotal,
    gcCount: 120 + Math.floor(Math.random() * 200),
    gcTime: 3000 + Math.floor(Math.random() * 5000),
    threadCount: 40 + Math.floor(Math.random() * 30),
  };
}

export function generateTaskManagers(): TaskManager[] {
  const tmIds = PLACEHOLDER_VALUES.TM_ID;
  const tmAddrs = PLACEHOLDER_VALUES.TM_ADDR;

  return TASK_MANAGERS.map((src, i) => ({
    id: tmIds[i] ?? `container_unknown_${i}`,
    path:
      tmAddrs[i] ?? `akka.tcp://flink@tm-${i + 1}:6122/user/rpc/taskmanager_0`,
    dataPort: 6121,
    lastHeartbeat: new Date(Date.now() - Math.floor(Math.random() * 5000)),
    slotsTotal: 4,
    slotsFree: 1 + Math.floor(Math.random() * 2),
    cpuCores: 4,
    physicalMemory: 8 * GB,
    jvmHeapSize: 4 * GB,
    managedMemory: 2 * GB,
    networkMemory: 512 * MB,
    metrics: generateTmMetrics(),
    _sourceLabel: src.label, // keep association for display
  })) as TaskManager[];
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
];

function generateJmMetricSeries(
  baseValue: number,
  variance: number,
  points: number,
): JvmMetricSample[] {
  const now = Date.now();
  const samples: JvmMetricSample[] = [];

  for (let i = 0; i < points; i++) {
    samples.push({
      timestamp: new Date(now - (points - 1 - i) * 5000),
      value: jitter(baseValue, variance),
    });
  }

  return samples;
}

export function generateJobManagerInfo(): JobManagerInfo {
  return {
    config: FLINK_CONFIG,
    metrics: generateJmMetrics(),
    logs: generateJmLogs(),
    stdout: generateJmStdout(),
  };
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
  };
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
  ];
  return lines.join("\n");
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
  ].join("\n");
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
  ];
}

// ---------------------------------------------------------------------------
// 2.7 — refreshMetrics (mutates in place for performance)
// ---------------------------------------------------------------------------

export function refreshMetrics(
  tms: TaskManager[],
  jm: JobManagerInfo,
  runningJobs: FlinkJob[],
): void {
  const now = new Date();

  // Update TM metrics with small deltas
  for (const tm of tms) {
    const m = tm.metrics;
    m.cpuUsage = Math.max(0, Math.min(100, jitter(m.cpuUsage, 0.05)));
    m.jvmHeapUsed = Math.max(
      0,
      Math.min(m.jvmHeapMax, jitter(m.jvmHeapUsed, 0.03)),
    );
    m.jvmNonHeapUsed = Math.max(
      0,
      Math.min(m.jvmNonHeapMax, jitter(m.jvmNonHeapUsed, 0.02)),
    );
    m.managedMemoryUsed = Math.max(
      0,
      Math.min(m.managedMemoryTotal, jitter(m.managedMemoryUsed, 0.02)),
    );
    m.networkMemoryUsed = Math.max(
      0,
      Math.min(m.networkMemoryTotal, jitter(m.networkMemoryUsed, 0.04)),
    );
    m.threadCount = Math.max(10, Math.round(jitter(m.threadCount, 0.03)));
    m.gcCount += Math.random() < 0.3 ? 1 : 0;
    m.gcTime += Math.random() < 0.3 ? Math.floor(Math.random() * 50) : 0;
    tm.lastHeartbeat = now;
  }

  // Append a new data point to JM time-series, dropping the oldest
  const jmm = jm.metrics;
  const pushSample = (
    series: JvmMetricSample[],
    base: number,
    variance: number,
  ) => {
    series.push({ timestamp: now, value: jitter(base, variance) });
    if (series.length > 30) series.shift();
  };

  pushSample(jmm.jvmHeapUsed, 600 * MB, 0.15);
  pushSample(jmm.jvmNonHeapUsed, 120 * MB, 0.1);
  pushSample(jmm.threadCount, 45, 0.1);
  pushSample(
    jmm.gcCount,
    jmm.gcCount[jmm.gcCount.length - 1]?.value ?? 80,
    0.02,
  );
  pushSample(
    jmm.gcTime,
    jmm.gcTime[jmm.gcTime.length - 1]?.value ?? 2200,
    0.02,
  );

  // Update running job durations
  for (const job of runningJobs) {
    job.duration = Date.now() - job.startTime.getTime();
  }
}
