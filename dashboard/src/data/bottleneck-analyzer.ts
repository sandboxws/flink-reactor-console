// ---------------------------------------------------------------------------
// Bottleneck Analyzer — pure scoring and recommendation functions
//
// All functions are pure: no store access, no side effects.
// Follows the flink-api-mappers.ts pattern for testability.
// ---------------------------------------------------------------------------

import type {
  FlinkJob,
  JobVertex,
  JobEdge,
  SubtaskMetrics,
  VertexBackPressure,
} from "./cluster-types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type BottleneckSeverity = "low" | "medium" | "high";

export type BottleneckScore = {
  vertexId: string;
  vertexName: string;
  jobId: string;
  jobName: string;
  parallelism: number;
  score: number; // 0-100 composite
  severity: BottleneckSeverity;
  factors: {
    backpressure: number; // 0-100
    busyTime: number; // 0-100
    throughputRatio: number; // 0-100
    skew: number; // 0-100
  };
};

export type RecommendationType =
  | "increase-parallelism"
  | "data-skew"
  | "slow-operator"
  | "backpressure-cascade";

export type Recommendation = {
  type: RecommendationType;
  vertexId: string;
  vertexName: string;
  jobId: string;
  jobName: string;
  score: number;
  message: string;
  detail: string;
};

// ---------------------------------------------------------------------------
// Scoring weights
// ---------------------------------------------------------------------------

const WEIGHTS = {
  backpressure: 0.4,
  busyTime: 0.3,
  throughputRatio: 0.2,
  skew: 0.1,
} as const;

// ---------------------------------------------------------------------------
// Severity thresholds
// ---------------------------------------------------------------------------

function scoreSeverity(score: number): BottleneckSeverity {
  if (score <= 30) return "low";
  if (score <= 60) return "medium";
  return "high";
}

// ---------------------------------------------------------------------------
// Factor computation helpers
// ---------------------------------------------------------------------------

function computeBackpressureFactor(
  bp: VertexBackPressure | undefined,
): number {
  if (!bp) return 0;

  // If per-subtask ratios are available, use average ratio
  if (bp.subtasks && bp.subtasks.length > 0) {
    const avgRatio =
      bp.subtasks.reduce((sum, s) => sum + s.ratio, 0) / bp.subtasks.length;
    return Math.round(avgRatio * 100);
  }

  // Fall back to level-based mapping
  switch (bp.level) {
    case "ok":
      return 0;
    case "low":
      return 50;
    case "high":
      return 100;
    default:
      return 0;
  }
}

function computeBusyTimeFactor(busyTimeMsPerSecond: number): number {
  // 1000ms/s means fully busy = 100
  return Math.min(100, Math.round((busyTimeMsPerSecond / 1000) * 100));
}

function computeThroughputRatioFactor(
  recordsIn: number,
  recordsOut: number,
): number {
  if (recordsIn <= 0) return 0;
  const dropRatio = 1 - recordsOut / recordsIn;
  return Math.min(100, Math.max(0, Math.round(dropRatio * 100)));
}

/**
 * Compute skew factor from subtask metrics.
 * Skew = (max - median) / median × 100, capped at 100.
 * Returns 0 if no subtask data is available.
 */
export function computeSkewFactor(
  subtaskMetrics?: SubtaskMetrics[],
): number {
  if (!subtaskMetrics || subtaskMetrics.length < 2) return 0;

  const outputs = subtaskMetrics
    .map((s) => s.recordsOut)
    .sort((a, b) => a - b);

  const median =
    outputs.length % 2 === 0
      ? (outputs[outputs.length / 2 - 1] + outputs[outputs.length / 2]) / 2
      : outputs[Math.floor(outputs.length / 2)];

  if (median <= 0) return 0;

  const max = outputs[outputs.length - 1];
  const skew = ((max - median) / median) * 100;
  return Math.min(100, Math.round(Math.max(0, skew)));
}

// ---------------------------------------------------------------------------
// Core scoring function
// ---------------------------------------------------------------------------

/**
 * Compute a bottleneck score for a single vertex.
 *
 * Formula: backpressure × 40% + busy_time × 30% + throughput_ratio × 20% + skew × 10%
 */
export function computeBottleneckScore(
  vertex: JobVertex,
  jobId: string,
  jobName: string,
  backpressure?: VertexBackPressure,
  subtaskMetrics?: SubtaskMetrics[],
): BottleneckScore {
  const bpFactor = computeBackpressureFactor(backpressure);
  const busyFactor = computeBusyTimeFactor(vertex.metrics.busyTimeMsPerSecond);
  const tpFactor = computeThroughputRatioFactor(
    vertex.metrics.recordsIn,
    vertex.metrics.recordsOut,
  );
  const skewFactor = computeSkewFactor(subtaskMetrics);

  const score = Math.round(
    bpFactor * WEIGHTS.backpressure +
      busyFactor * WEIGHTS.busyTime +
      tpFactor * WEIGHTS.throughputRatio +
      skewFactor * WEIGHTS.skew,
  );

  return {
    vertexId: vertex.id,
    vertexName: vertex.name,
    jobId,
    jobName,
    parallelism: vertex.parallelism,
    score,
    severity: scoreSeverity(score),
    factors: {
      backpressure: bpFactor,
      busyTime: busyFactor,
      throughputRatio: tpFactor,
      skew: skewFactor,
    },
  };
}

// ---------------------------------------------------------------------------
// Recommendation generation
// ---------------------------------------------------------------------------

/**
 * Generate actionable recommendations based on bottleneck scores and the
 * vertex edge graph. Sorted by score descending, deduplicated per vertex
 * (only the highest-priority recommendation is kept).
 */
export function generateRecommendations(
  scores: BottleneckScore[],
  edges: JobEdge[],
): Recommendation[] {
  const recommendations: Recommendation[] = [];
  const scoreByVertex = new Map(scores.map((s) => [s.vertexId, s]));

  for (const s of scores) {
    // 1. Increase parallelism: BP > 70 AND busy > 70
    if (s.factors.backpressure > 70 && s.factors.busyTime > 70) {
      recommendations.push({
        type: "increase-parallelism",
        vertexId: s.vertexId,
        vertexName: s.vertexName,
        jobId: s.jobId,
        jobName: s.jobName,
        score: s.score,
        message: `Increase parallelism on ${s.vertexName}`,
        detail: `High backpressure (${s.factors.backpressure}%) combined with high CPU utilization (${s.factors.busyTime}%) suggests this operator needs more parallel instances to keep up with input throughput.`,
      });
    }

    // 2. Data skew: skew factor > 50
    if (s.factors.skew > 50) {
      recommendations.push({
        type: "data-skew",
        vertexId: s.vertexId,
        vertexName: s.vertexName,
        jobId: s.jobId,
        jobName: s.jobName,
        score: s.score,
        message: `Data skew detected on ${s.vertexName}`,
        detail: `Subtask output variance is ${s.factors.skew}% above median. Some subtasks process significantly more data than others. Consider using a different partitioning strategy.`,
      });
    }

    // 3. Slow operator: busy > 80 AND throughput ratio > 50
    if (s.factors.busyTime > 80 && s.factors.throughputRatio > 50) {
      recommendations.push({
        type: "slow-operator",
        vertexId: s.vertexId,
        vertexName: s.vertexName,
        jobId: s.jobId,
        jobName: s.jobName,
        score: s.score,
        message: `Slow operator: ${s.vertexName}`,
        detail: `This operator is CPU-bound (${s.factors.busyTime}% busy) with a significant throughput drop (${s.factors.throughputRatio}%). Consider optimizing the operator logic or reducing input volume.`,
      });
    }

    // 4. Backpressure cascade: vertex has high BP AND upstream has ok/low BP
    if (s.factors.backpressure > 70) {
      // Find upstream vertices via edges (edges point source → target)
      const upstreamIds = edges
        .filter((e) => e.target === s.vertexId)
        .map((e) => e.source);

      for (const upId of upstreamIds) {
        const upstream = scoreByVertex.get(upId);
        if (upstream && upstream.factors.backpressure <= 50) {
          recommendations.push({
            type: "backpressure-cascade",
            vertexId: s.vertexId,
            vertexName: s.vertexName,
            jobId: s.jobId,
            jobName: s.jobName,
            score: s.score,
            message: `Backpressure cascade: ${s.vertexName} is slowing ${upstream.vertexName}`,
            detail: `${s.vertexName} has high backpressure (${s.factors.backpressure}%) while upstream ${upstream.vertexName} has low backpressure (${upstream.factors.backpressure}%). The downstream operator is the bottleneck causing the cascade.`,
          });
        }
      }
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Deduplicate per vertex: keep highest-priority recommendation
  const seen = new Set<string>();
  return recommendations.filter((r) => {
    const key = `${r.jobId}-${r.vertexId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------------------------------------------------------------------------
// Convenience: analyze a full job
// ---------------------------------------------------------------------------

/**
 * Analyze an entire job: score all vertices, then generate recommendations.
 * Returns scores and recommendations for the job.
 */
export function analyzeJob(job: FlinkJob): {
  scores: BottleneckScore[];
  recommendations: Recommendation[];
} {
  if (!job.plan || job.status !== "RUNNING") {
    return { scores: [], recommendations: [] };
  }

  const scores = job.plan.vertices.map((vertex) =>
    computeBottleneckScore(
      vertex,
      job.id,
      job.name,
      job.backpressure[vertex.id],
      job.subtaskMetrics[vertex.id],
    ),
  );

  const recommendations = generateRecommendations(scores, job.plan.edges);

  return { scores, recommendations };
}
