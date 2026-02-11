// ---------------------------------------------------------------------------
// Mappers: Flink REST API response types → dashboard domain types
// Pure functions — no side effects, no API calls.
// ---------------------------------------------------------------------------

import type {
  FlinkOverviewResponse,
  FlinkJobsOverviewResponse,
  FlinkJobOverviewEntry,
  FlinkTaskCounts,
} from "./flink-api-types";
import type {
  ClusterOverview,
  FlinkJob,
  JobStatus,
  TaskCounts,
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
