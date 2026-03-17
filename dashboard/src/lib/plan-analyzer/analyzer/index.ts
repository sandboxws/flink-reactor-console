import type {
  AnalyzedFlinkPlan,
  FlinkAntiPattern,
  FlinkOperatorNode,
  NormalizedFlinkPlan,
} from "../types"
import { analyzeBottlenecks } from "./bottleneck-analyzer"
import { analyzeChangelog } from "./changelog-analyzer"
import { analyzeJoins } from "./join-analyzer"
import { generateRecommendations } from "./recommendations"
import { analyzeSkew } from "./skew-analyzer"
import { analyzeState } from "./state-analyzer"
import { analyzeWatermarks } from "./watermark-analyzer"
import { analyzeWindows } from "./window-analyzer"

export { analyzeBottlenecks } from "./bottleneck-analyzer"
export { analyzeChangelog } from "./changelog-analyzer"
export { analyzeJoins } from "./join-analyzer"
export { generateRecommendations } from "./recommendations"
export { analyzeSkew } from "./skew-analyzer"
export { analyzeState } from "./state-analyzer"
export { analyzeWatermarks } from "./watermark-analyzer"
export { analyzeWindows } from "./window-analyzer"

function generatePlanId(): string {
  return `flink-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function generatePlanName(root: FlinkOperatorNode): string {
  const sinks: string[] = []
  const sources: string[] = []

  function traverse(node: FlinkOperatorNode) {
    if (node.category === "sink") {
      const name =
        node.relation ||
        node.operatorType ||
        node.operation?.replace("Sink: ", "") ||
        "Sink"
      sinks.push(name)
    }
    if (node.category === "source") {
      const name =
        node.relation ||
        node.operatorType ||
        node.operation?.replace("Source: ", "") ||
        "Source"
      sources.push(name)
    }
    for (const child of node.children) {
      traverse(child)
    }
  }

  traverse(root)

  if (sinks.length > 0 && sources.length > 0) {
    return `${sources[0]} → ${sinks[0]}`
  }
  if (sinks.length > 0) {
    return `Query → ${sinks[0]}`
  }
  if (sources.length > 0) {
    return `${sources[0]} Query`
  }
  return "Flink Query"
}

function traverseHasCategory(
  node: FlinkOperatorNode,
  category: string,
): boolean {
  if (node.category === category) {
    return true
  }
  for (const child of node.children) {
    if (traverseHasCategory(child, category)) {
      return true
    }
  }
  return false
}

export function analyzePlan(plan: NormalizedFlinkPlan): AnalyzedFlinkPlan {
  const root = plan.root

  // Run all analyzers
  const stateResult = analyzeState(root)
  const joinResult = analyzeJoins(root)
  const watermarkResult = analyzeWatermarks(root)
  const skewResult = analyzeSkew(root)
  const changelogResult = analyzeChangelog(root)
  const windowResult = analyzeWindows(root)
  const bottleneckResult = analyzeBottlenecks(root)

  // Combine all anti-patterns
  const antiPatterns: FlinkAntiPattern[] = [
    ...stateResult.antiPatterns,
    ...joinResult.antiPatterns,
    ...watermarkResult.antiPatterns,
    ...skewResult.antiPatterns,
    ...changelogResult.antiPatterns,
    ...windowResult.antiPatterns,
  ]

  // Generate recommendations
  const recommendations = generateRecommendations({
    antiPatterns,
    bottlenecks: bottleneckResult.bottlenecks,
    stateForecasts: stateResult.forecasts,
    watermarkHealth: watermarkResult.health,
    totalEstimatedState24h: stateResult.totalEstimatedState24h,
  })

  // Calculate critical path (simplified — top bottlenecks)
  const criticalPath = bottleneckResult.bottlenecks
    .slice(0, 3)
    .map((b) => b.nodeId)

  // Determine workload type
  const hasWindows =
    windowResult.antiPatterns.length > 0 || traverseHasCategory(root, "window")
  const hasAggregations = traverseHasCategory(root, "aggregation")
  const workloadType: "OLTP" | "OLAP" | "Mixed" =
    hasWindows || hasAggregations ? "OLAP" : "OLTP"

  return {
    ...plan,
    id: generatePlanId(),
    name: generatePlanName(root),
    createdAt: Date.now(),

    antiPatterns,
    bottlenecks: bottleneckResult.bottlenecks,
    recommendations,
    workloadType,
    criticalPath,

    // Flink-specific analysis results
    stateForecasts: stateResult.forecasts,
    watermarkHealth: watermarkResult.health,
    totalEstimatedState24h: stateResult.totalEstimatedState24h,
    totalEstimatedState7d: stateResult.totalEstimatedState7d,
  }
}
