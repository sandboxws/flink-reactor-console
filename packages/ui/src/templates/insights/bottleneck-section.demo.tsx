"use client"

import { createBottleneckScore, createRecommendation } from "../../fixtures"
import { BottleneckSection } from "./bottleneck-section"

const bottlenecks = [
  createBottleneckScore({ score: 78, severity: "high" }),
  createBottleneckScore({
    vertexId: "vertex-1",
    vertexName: "Map -> Filter -> Watermark",
    score: 42,
    severity: "medium",
    factors: { backpressure: 30, busyTime: 55, throughputRatio: 45, skew: 35 },
  }),
  createBottleneckScore({
    vertexId: "vertex-0",
    vertexName: "Source: Kafka [orders]",
    score: 18,
    severity: "low",
    factors: { backpressure: 10, busyTime: 25, throughputRatio: 20, skew: 15 },
  }),
]

const recommendations = [
  createRecommendation(),
  createRecommendation({
    type: "data-skew",
    vertexId: "vertex-2",
    vertexName: "Aggregate: SUM(amount)",
    message: "Potential data skew detected on grouping key",
    detail:
      "Subtask 3 processes 4x more records than subtask 0. Consider adding a local pre-aggregation or salting the key.",
    score: 60,
  }),
]

/** Standalone demo of the bottleneck analysis section with fixture scores and recommendations. */
export function BottleneckSectionDemo() {
  return (
    <div className="max-w-5xl rounded-lg border border-dash-border bg-dash-surface">
      <BottleneckSection
        bottlenecks={bottlenecks}
        recommendations={recommendations}
        onNodeClick={(id) => console.log("navigate to vertex", id)}
      />
    </div>
  )
}
