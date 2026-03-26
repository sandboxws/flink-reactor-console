"use client"

import type { FlinkAntiPattern, StateGrowthForecast } from "../../types/plan-analyzer"
import { PlanAnalyzerSection } from "./plan-analyzer-section"

const antiPatterns: FlinkAntiPattern[] = [
  {
    id: "ap-1",
    nodeId: "node-3",
    severity: "critical",
    type: "unbounded-state-join",
    title: "Unbounded State Join",
    description:
      "Regular join between 'orders' and 'customers' has no TTL configured. State will grow without bound.",
    suggestion:
      "Add state TTL via table.exec.state.ttl or convert to an interval join if possible.",
    flinkConfig: "table.exec.state.ttl = 24h",
  },
  {
    id: "ap-2",
    nodeId: "node-5",
    severity: "warning",
    type: "count-distinct-high-cardinality",
    title: "COUNT DISTINCT on High-Cardinality Key",
    description:
      "COUNT(DISTINCT user_id) operates on a high-cardinality column. State may become large.",
    suggestion:
      "Consider approximate counting (APPROX_COUNT_DISTINCT) or adding a window.",
    sqlRewrite:
      "SELECT APPROX_COUNT_DISTINCT(user_id) FROM orders GROUP BY TUMBLE(ts, INTERVAL '1' HOUR)",
  },
  {
    id: "ap-3",
    nodeId: "node-1",
    severity: "info",
    type: "missing-watermark",
    title: "Source Without Explicit Watermark",
    description: "Source 'orders' does not define a watermark strategy.",
    suggestion: "Add WATERMARK FOR ts AS ts - INTERVAL '5' SECOND in the DDL.",
    ddlFix:
      "CREATE TABLE orders (\n  ...\n  ts TIMESTAMP(3),\n  WATERMARK FOR ts AS ts - INTERVAL '5' SECOND\n)",
  },
]

const forecast: StateGrowthForecast[] = [
  {
    operatorId: "node-3",
    operatorName: "Join: orders x customers",
    stateType: "MapState",
    growthPattern: "unbounded",
    estimatedSize1h: 52_428_800,
    estimatedSize24h: 1_258_291_200,
    estimatedSize7d: 8_808_038_400,
    ttlConfigured: false,
    warning: "State will grow without limit. Configure TTL or switch to interval join.",
  },
  {
    operatorId: "node-5",
    operatorName: "Aggregate: COUNT(DISTINCT user_id)",
    stateType: "ValueState",
    growthPattern: "linear",
    estimatedSize1h: 10_485_760,
    estimatedSize24h: 209_715_200,
    estimatedSize7d: 1_468_006_400,
    ttlConfigured: true,
    ttlDuration: 86_400_000,
  },
]

/** Standalone demo of the plan analyzer section with fixture anti-patterns and state forecasts. */
export function PlanAnalyzerSectionDemo() {
  return (
    <div className="max-w-3xl rounded-lg border border-dash-border bg-dash-surface">
      <PlanAnalyzerSection
        plan={{}}
        antiPatterns={antiPatterns}
        forecast={forecast}
      />
    </div>
  )
}
