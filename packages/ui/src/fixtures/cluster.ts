import type {
  ClusterOverview,
  FlinkJob,
  JobStatus,
  JobVertex,
  JobVertexMetrics,
  JobEdge,
  JobPlan,
  TaskCounts,
  ShipStrategy,
  JobConnector,
  FlinkFeatureFlags,
  Checkpoint,
  CheckpointCounts,
  CheckpointConfig,
} from "../types"

let counter = 0
function uid() { return `${Date.now().toString(36)}-${(counter++).toString(36)}` }

export function createTaskCounts(overrides?: Partial<TaskCounts>): TaskCounts {
  return { pending: 0, running: 4, finished: 0, canceling: 0, failed: 0, ...overrides }
}

export function createVertexMetrics(overrides?: Partial<JobVertexMetrics>): JobVertexMetrics {
  return {
    recordsIn: 125_000,
    recordsOut: 124_800,
    bytesIn: 48_000_000,
    bytesOut: 47_500_000,
    busyTimeMsPerSecond: 650,
    backPressuredTimeMsPerSecond: 50,
    ...overrides,
  }
}

export function createJobVertex(overrides?: Partial<JobVertex>): JobVertex {
  const id = overrides?.id ?? uid()
  return {
    id,
    name: "Map → Filter",
    parallelism: 4,
    status: "RUNNING",
    metrics: createVertexMetrics(),
    tasks: createTaskCounts(),
    duration: 3_600_000,
    startTime: Date.now() - 3_600_000,
    ...overrides,
  }
}

export function createJobEdge(overrides?: Partial<JobEdge>): JobEdge {
  return {
    source: uid(),
    target: uid(),
    shipStrategy: "HASH",
    ...overrides,
  }
}

export function createJobPlan(vertexCount = 4): JobPlan {
  const vertices: JobVertex[] = []
  const edges: JobEdge[] = []
  const names = [
    "Source: Kafka [orders]",
    "Map → Filter → Watermark",
    "Aggregate: SUM(amount)",
    "Sink: Iceberg [order_summary]",
  ]
  for (let i = 0; i < vertexCount; i++) {
    vertices.push(createJobVertex({
      name: names[i % names.length],
      id: `vertex-${i}`,
    }))
    if (i > 0) {
      edges.push(createJobEdge({
        source: `vertex-${i - 1}`,
        target: `vertex-${i}`,
        shipStrategy: i === 1 ? "FORWARD" : "HASH",
      }))
    }
  }
  return { vertices, edges }
}

export function createCheckpoint(overrides?: Partial<Checkpoint>): Checkpoint {
  return {
    id: Math.floor(Math.random() * 1000) + 1,
    status: "COMPLETED",
    triggerTimestamp: new Date(Date.now() - 60_000),
    duration: 1_250,
    size: 15_728_640,
    processedData: 2_097_152,
    isSavepoint: false,
    ...overrides,
  }
}

export function createCheckpointCounts(overrides?: Partial<CheckpointCounts>): CheckpointCounts {
  return { completed: 142, failed: 0, inProgress: 0, total: 142, ...overrides }
}

export function createCheckpointConfig(overrides?: Partial<CheckpointConfig>): CheckpointConfig {
  return {
    mode: "EXACTLY_ONCE",
    interval: 60_000,
    timeout: 600_000,
    minPause: 0,
    maxConcurrent: 1,
    ...overrides,
  }
}

export function createConnector(overrides?: Partial<JobConnector>): JobConnector {
  return {
    vertexId: "vertex-0",
    vertexName: "Source: Kafka [orders]",
    connectorType: "kafka",
    role: "source",
    resource: "orders",
    confidence: 1.0,
    detectionMethod: "manifest",
    metrics: { recordsRead: 500_000, recordsWritten: 0, bytesRead: 200_000_000, bytesWritten: 0 },
    ...overrides,
  }
}

export function createFlinkJob(overrides?: Partial<FlinkJob>): FlinkJob {
  const id = overrides?.id ?? uid()
  const plan = overrides?.plan !== undefined ? overrides.plan : createJobPlan()
  return {
    id,
    name: "ecommerce-order-enrichment",
    status: "RUNNING",
    startTime: new Date(Date.now() - 3_600_000),
    endTime: null,
    duration: 3_600_000,
    tasks: createTaskCounts(),
    parallelism: 4,
    plan,
    exceptions: [],
    checkpoints: [createCheckpoint(), createCheckpoint({ id: 141 })],
    checkpointCounts: createCheckpointCounts(),
    checkpointConfig: createCheckpointConfig(),
    checkpointLatest: null,
    subtaskMetrics: {},
    configuration: [
      { key: "execution.runtime-mode", value: "STREAMING" },
      { key: "execution.checkpointing.interval", value: "60000" },
    ],
    watermarks: {},
    backpressure: {},
    accumulators: {},
    sourcesAndSinks: [
      createConnector(),
      createConnector({
        vertexId: "vertex-3",
        vertexName: "Sink: Iceberg [order_summary]",
        connectorType: "iceberg",
        role: "sink",
        resource: "order_summary",
        metrics: { recordsRead: 0, recordsWritten: 480_000, bytesRead: 0, bytesWritten: 190_000_000 },
      }),
    ],
    ...overrides,
  }
}

export function createClusterOverview(overrides?: Partial<ClusterOverview>): ClusterOverview {
  return {
    flinkVersion: "1.20.1",
    flinkCommitId: "a1b2c3d",
    totalTaskSlots: 12,
    availableTaskSlots: 4,
    runningJobs: 2,
    finishedJobs: 5,
    cancelledJobs: 1,
    failedJobs: 0,
    taskManagerCount: 3,
    capabilities: ["SQL Gateway", "Kubernetes HA"],
    ...overrides,
  }
}

export function createFeatureFlags(overrides?: Partial<FlinkFeatureFlags>): FlinkFeatureFlags {
  return {
    webSubmit: true,
    webCancel: true,
    webRescale: false,
    webHistory: true,
    webProfiler: false,
    ...overrides,
  }
}
