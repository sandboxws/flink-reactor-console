// ---------------------------------------------------------------------------
// Mock generators that produce data in Flink REST API format.
// Used by proxy routes when mockMode=true so the full pipeline is exercised.
// ---------------------------------------------------------------------------

import type { FlinkOverviewResponse, FlinkJobsOverviewResponse, FlinkTaskCounts } from "./flink-api-types";
import type { ClusterOverview, FlinkJob, TaskCounts } from "./cluster-types";
import {
  generateClusterOverview,
  generateRunningJobs,
  generateCompletedJobs,
  generateTaskManagers,
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
