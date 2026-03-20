import type { ClusterOverview, FlinkJob, TaskManager, LogEntry, HealthSnapshot, BottleneckScore, Recommendation, HealthIssue } from "../types"
import { createClusterOverview, createFlinkJob, createCheckpoint } from "./cluster"
import { createTaskManager } from "./task-managers"
import { createLogEntries } from "./logs"
import { createHealthSnapshot, createHealthIssue, createBottleneckScore, createRecommendation } from "./health"

export type ClusterScenario = {
  overview: ClusterOverview
  jobs: FlinkJob[]
  taskManagers: TaskManager[]
  logs: LogEntry[]
  health: HealthSnapshot
  issues: HealthIssue[]
  bottlenecks: BottleneckScore[]
  recommendations: Recommendation[]
}

export function healthyCluster(): ClusterScenario {
  return {
    overview: createClusterOverview({ runningJobs: 2, failedJobs: 0 }),
    jobs: [
      createFlinkJob({ name: "ecommerce-order-enrichment", status: "RUNNING" }),
      createFlinkJob({ name: "user-activity-aggregation", status: "RUNNING", id: "job-002" }),
    ],
    taskManagers: [
      createTaskManager(),
      createTaskManager(),
      createTaskManager(),
    ],
    logs: createLogEntries(100),
    health: createHealthSnapshot({ score: 92 }),
    issues: [],
    bottlenecks: [],
    recommendations: [],
  }
}

export function degradedCluster(): ClusterScenario {
  return {
    overview: createClusterOverview({ runningJobs: 2, availableTaskSlots: 1 }),
    jobs: [
      createFlinkJob({ name: "ecommerce-order-enrichment", status: "RUNNING" }),
      createFlinkJob({
        name: "user-activity-aggregation",
        status: "RUNNING",
        id: "job-002",
        checkpoints: [
          createCheckpoint({ duration: 8_500, status: "COMPLETED" }),
          createCheckpoint({ duration: 12_000, status: "IN_PROGRESS" }),
        ],
      }),
    ],
    taskManagers: [
      createTaskManager(),
      createTaskManager(),
      createTaskManager(),
    ],
    logs: createLogEntries(200),
    health: createHealthSnapshot({ score: 65 }),
    issues: [
      createHealthIssue({ severity: "warning", message: "Checkpoint duration increasing on user-activity-aggregation" }),
      createHealthIssue({ severity: "warning", message: "Elevated backpressure on Aggregate vertex" }),
    ],
    bottlenecks: [createBottleneckScore()],
    recommendations: [createRecommendation()],
  }
}

export function failingCluster(): ClusterScenario {
  return {
    overview: createClusterOverview({ runningJobs: 1, failedJobs: 1, availableTaskSlots: 5 }),
    jobs: [
      createFlinkJob({ name: "ecommerce-order-enrichment", status: "RUNNING" }),
      createFlinkJob({
        name: "user-activity-aggregation",
        status: "FAILED",
        id: "job-002",
        endTime: new Date(Date.now() - 600_000),
        exceptions: [
          {
            timestamp: new Date(Date.now() - 600_000),
            name: "java.lang.OutOfMemoryError",
            message: "Java heap space",
            stacktrace: "java.lang.OutOfMemoryError: Java heap space\n\tat ...",
            taskName: "Aggregate: SUM(amount)",
            location: "container_456 @ host-02",
          },
        ],
      }),
    ],
    taskManagers: [
      createTaskManager(),
      createTaskManager({ metrics: { cpuUsage: 0.92, heapUsed: 3_900_000_000, heapCommitted: 4_294_967_296, heapMax: 4_294_967_296, nonHeapUsed: 120_000_000, nonHeapCommitted: 150_000_000, nonHeapMax: 268_435_456, directCount: 128, directUsed: 64_000_000, directMax: 134_217_728, mappedCount: 0, mappedUsed: 0, mappedMax: 0, nettyShuffleMemoryAvailable: 200_000_000, nettyShuffleMemoryUsed: 873_741_824, nettyShuffleMemoryTotal: 1_073_741_824, nettyShuffleSegmentsAvailable: 5_000, nettyShuffleSegmentsUsed: 27_000, nettyShuffleSegmentsTotal: 32_000, managedMemoryUsed: 2_000_000_000, managedMemoryTotal: 2_147_483_648, metaspaceUsed: 240_000_000, metaspaceMax: 268_435_456, garbageCollectors: [{ name: "G1 Young Generation", count: 1_200, time: 45_000 }, { name: "G1 Old Generation", count: 25, time: 8_000 }], threadCount: 142 } as any }),
      createTaskManager(),
    ],
    logs: createLogEntries(300),
    health: createHealthSnapshot({ score: 35 }),
    issues: [
      createHealthIssue({ severity: "critical", message: "Job user-activity-aggregation FAILED with OutOfMemoryError" }),
      createHealthIssue({ severity: "critical", message: "TM-1 heap at 91% — risk of OOM" }),
      createHealthIssue({ severity: "warning", message: "GC pause time elevated on TM-1" }),
    ],
    bottlenecks: [
      createBottleneckScore({ score: 90, severity: "high" }),
    ],
    recommendations: [
      createRecommendation({ type: "increase-parallelism", message: "Increase TM heap from 4GB to 8GB" }),
    ],
  }
}

export function emptyCluster(): ClusterScenario {
  return {
    overview: createClusterOverview({
      runningJobs: 0,
      finishedJobs: 0,
      cancelledJobs: 0,
      failedJobs: 0,
      totalTaskSlots: 12,
      availableTaskSlots: 12,
    }),
    jobs: [],
    taskManagers: [
      createTaskManager({ allocatedSlots: [] }),
      createTaskManager({ allocatedSlots: [] }),
      createTaskManager({ allocatedSlots: [] }),
    ],
    logs: [],
    health: createHealthSnapshot({ score: 100 }),
    issues: [],
    bottlenecks: [],
    recommendations: [],
  }
}
