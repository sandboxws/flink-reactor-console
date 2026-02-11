// ---------------------------------------------------------------------------
// Mock generators that produce data in Flink REST API format.
// Used by proxy routes when mockMode=true so the full pipeline is exercised.
// ---------------------------------------------------------------------------

import type {
  FlinkOverviewResponse,
  FlinkJobsOverviewResponse,
  FlinkTaskCounts,
  FlinkJobDetailAggregate,
  FlinkJobDetailResponse,
  FlinkJobPlan,
  FlinkVertexInfo,
  FlinkVertexMetrics,
  FlinkJobExceptionsResponse,
  FlinkCheckpointingStatistics,
  FlinkCheckpointConfigResponse,
  FlinkJobConfigResponse,
  FlinkVertexDetailResponse,
  FlinkPlanNode,
  FlinkWatermarksResponse,
  FlinkVertexBackPressureResponse,
  FlinkVertexAccumulatorsResponse,
} from "./flink-api-types";
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
  UserAccumulator,
  VertexBackPressure,
  VertexWatermark,
} from "./cluster-types";
import {
  generateClusterOverview,
  generateRunningJobs,
  generateCompletedJobs,
  generateTaskManagers,
  generateJobPlan,
  generateJobExceptions,
  generateCheckpoints,
  generateSubtaskMetrics,
  generateJobConfiguration,
  generateWatermarks,
  generateBackPressure,
  generateAccumulators,
} from "./mock-cluster";

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
  };
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
  };
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
  };
}

// ---------------------------------------------------------------------------
// Public generators — called by proxy routes
// ---------------------------------------------------------------------------

export function generateMockOverviewApiResponse(): FlinkOverviewResponse {
  const tms = generateTaskManagers();
  const running = generateRunningJobs();
  const completed = generateCompletedJobs();
  const overview = generateClusterOverview(running, completed, tms);
  return overviewToApi(overview);
}

export function generateMockJobsOverviewApiResponse(): FlinkJobsOverviewResponse {
  const running = generateRunningJobs();
  const completed = generateCompletedJobs();
  return jobsToApi([...running, ...completed]);
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
  };
}

function domainVertexToApi(v: JobVertex, jobDurationMs: number): FlinkVertexInfo {
  const durationSec = Math.max(1, jobDurationMs / 1000);
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
  };

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
  };
}

function domainPlanToApi(
  plan: JobPlan,
  jobId: string,
  jobName: string,
  edges: JobEdge[],
): FlinkJobPlan {
  // Build a lookup: target → edges arriving at that target
  const edgesByTarget = new Map<string, JobEdge[]>();
  for (const e of edges) {
    const list = edgesByTarget.get(e.target) ?? [];
    list.push(e);
    edgesByTarget.set(e.target, list);
  }

  const nodes: FlinkPlanNode[] = plan.vertices.map((v, i) => {
    const incoming = edgesByTarget.get(v.id) ?? [];
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
    };
  });

  return { jid: jobId, name: jobName, type: "STREAMING", nodes };
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
  };
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
  };
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
  };
}

function domainJobConfigToApi(
  configuration: JobConfiguration[],
  jobId: string,
  jobName: string,
): FlinkJobConfigResponse {
  const userConfig: Record<string, string> = {};
  for (const c of configuration) {
    userConfig[c.key] = c.value;
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
  };
}

function domainSubtaskMetricsToApi(
  subtaskMetrics: Record<string, SubtaskMetrics[]>,
  vertices: JobVertex[],
): Record<string, FlinkVertexDetailResponse> {
  const result: Record<string, FlinkVertexDetailResponse> = {};
  const now = Date.now();

  for (const vertex of vertices) {
    const subtasks = subtaskMetrics[vertex.id] ?? [];
    result[vertex.id] = {
      id: vertex.id,
      name: vertex.name,
      parallelism: vertex.parallelism,
      now,
      subtasks: subtasks.map((s) => {
        const durationSec = Math.max(1, s.duration / 1000);
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
            "accumulated-backpressured-time": Math.round(s.backPressuredTimeMsPerSecond * durationSec),
            "accumulated-idle-time": Math.round(s.idleTimeMsPerSecond * durationSec),
            "accumulated-busy-time": Math.round(s.busyTimeMsPerSecond * durationSec),
          },
          "taskmanager-id": s.taskManagerId,
        };
      }),
    };
  }

  return result;
}

function domainWatermarksToApi(
  watermarks: Record<string, VertexWatermark[]>,
): Record<string, FlinkWatermarksResponse> {
  const result: Record<string, FlinkWatermarksResponse> = {};

  for (const [vertexId, wms] of Object.entries(watermarks)) {
    result[vertexId] = wms.map((w) => ({
      id: `${w.subtaskIndex}.currentInputWatermark`,
      value: w.watermark === -Infinity ? "-9223372036854775808" : String(w.watermark),
    }));
  }

  return result;
}

function domainBackPressureToApi(
  backpressure: Record<string, VertexBackPressure>,
): Record<string, FlinkVertexBackPressureResponse> {
  const result: Record<string, FlinkVertexBackPressureResponse> = {};

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
    };
  }

  return result;
}

function domainAccumulatorsToApi(
  accumulators: Record<string, UserAccumulator[]>,
): Record<string, FlinkVertexAccumulatorsResponse> {
  const result: Record<string, FlinkVertexAccumulatorsResponse> = {};

  for (const [vertexId, accs] of Object.entries(accumulators)) {
    result[vertexId] = {
      id: vertexId,
      "user-accumulators": accs.map((a) => ({
        name: a.name,
        type: a.type,
        value: a.value,
      })),
    };
  }

  return result;
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
  const running = generateRunningJobs();
  const completed = generateCompletedJobs();
  const allJobs = [...running, ...completed];
  const domainJob = allJobs.find((j) => j.id === jobId);

  // If job not found, generate a standalone one (shouldn't happen in practice)
  const jobName = domainJob?.name ?? "UnknownJob";
  const jobStatus = domainJob?.status ?? "RUNNING";
  const startTime = domainJob?.startTime ?? new Date();
  const endTime = domainJob?.endTime;
  const duration = domainJob?.duration ?? 60_000;
  const parallelism = domainJob?.parallelism ?? 4;

  // Generate domain detail data
  const plan = generateJobPlan(parallelism, jobStatus, startTime);
  const exceptions = generateJobExceptions(jobStatus, plan.vertices);
  const { checkpoints, config: ckpConfig } = generateCheckpoints(jobStatus);
  const subtaskMetrics = generateSubtaskMetrics(plan.vertices);
  const configuration = generateJobConfiguration();
  const watermarks = generateWatermarks(plan.vertices);
  const backpressure = generateBackPressure(plan.vertices);
  const accumulators = generateAccumulators(plan.vertices);

  // Reverse-map to API format
  const apiVertices = plan.vertices.map((v) => domainVertexToApi(v, duration));
  const apiPlan = domainPlanToApi(plan, jobId, jobName, plan.edges);

  // Assemble status-counts from all vertices
  const statusCounts: Record<string, number> = {};
  for (const v of apiVertices) {
    for (const [state, count] of Object.entries(v.tasks)) {
      statusCounts[state] = (statusCounts[state] ?? 0) + count;
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
  };

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
  };
}
