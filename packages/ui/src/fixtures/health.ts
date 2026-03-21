import type { HealthSnapshot, HealthSubScore, HealthIssue, BottleneckScore, Recommendation } from "../types"

export function createHealthSubScore(overrides?: Partial<HealthSubScore>): HealthSubScore {
  return {
    name: "Slot Utilization",
    score: 85,
    weight: 0.25,
    status: "healthy",
    detail: "8 of 12 slots in use (67%)",
    ...overrides,
  }
}

export function createHealthSnapshot(overrides?: Partial<HealthSnapshot>): HealthSnapshot {
  return {
    timestamp: new Date(),
    score: 82,
    subScores: [
      createHealthSubScore({ name: "Slot Utilization", score: 85, weight: 0.25, status: "healthy" }),
      createHealthSubScore({ name: "Backpressure", score: 75, weight: 0.25, status: "warning", detail: "1 vertex with elevated backpressure" }),
      createHealthSubScore({ name: "Checkpoint Health", score: 92, weight: 0.25, status: "healthy", detail: "100% success rate, avg 1.2s" }),
      createHealthSubScore({ name: "Memory Pressure", score: 78, weight: 0.15, status: "healthy", detail: "TM heap at 42% avg" }),
      createHealthSubScore({ name: "Exception Rate", score: 95, weight: 0.10, status: "healthy", detail: "0 exceptions in last hour" }),
    ],
    ...overrides,
  }
}

export function createHealthIssue(overrides?: Partial<HealthIssue>): HealthIssue {
  return {
    id: `issue-${Date.now().toString(36)}`,
    severity: "warning",
    message: "Vertex 'Aggregate: SUM(amount)' showing elevated backpressure (ratio: 0.65)",
    source: "backpressure-monitor",
    timestamp: new Date(),
    ...overrides,
  }
}

export function createBottleneckScore(overrides?: Partial<BottleneckScore>): BottleneckScore {
  return {
    vertexId: "vertex-2",
    vertexName: "Aggregate: SUM(amount)",
    jobId: "job-001",
    jobName: "ecommerce-order-enrichment",
    parallelism: 4,
    score: 65,
    severity: "medium",
    factors: {
      backpressure: 70,
      busyTime: 80,
      throughputRatio: 55,
      skew: 40,
    },
    ...overrides,
  }
}

export function createRecommendation(overrides?: Partial<Recommendation>): Recommendation {
  return {
    type: "increase-parallelism",
    vertexId: "vertex-2",
    vertexName: "Aggregate: SUM(amount)",
    jobId: "job-001",
    jobName: "ecommerce-order-enrichment",
    score: 75,
    message: "Consider increasing parallelism for vertex 'Aggregate: SUM(amount)'",
    detail: "This vertex shows high busy time (80%) with moderate backpressure. Increasing parallelism from 4 to 8 may improve throughput.",
    ...overrides,
  }
}
