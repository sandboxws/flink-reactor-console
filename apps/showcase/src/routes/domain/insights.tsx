import {
  BottleneckDAG,
  BottleneckTable,
  HealthTrendChart,
  SubScoreGrid,
  TopIssuesList,
} from "@flink-reactor/ui"
import {
  createBottleneckScore,
  createHealthIssue,
  createHealthSnapshot,
  createJobEdge,
} from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const snapshot = createHealthSnapshot()

// Build a small history of health snapshots
const history = Array.from({ length: 20 }, (_, i) =>
  createHealthSnapshot({
    timestamp: new Date(Date.now() - (20 - i) * 60_000),
    score: 75 + Math.floor(Math.random() * 15),
  }),
)

const issues = [
  createHealthIssue({
    severity: "warning",
    message:
      "Vertex 'Aggregate: SUM(amount)' showing elevated backpressure (ratio: 0.65)",
  }),
  createHealthIssue({
    id: "issue-2",
    severity: "critical",
    message: "Checkpoint duration trending up: avg 4.2s (threshold 3s)",
    source: "checkpoint-monitor",
  }),
  createHealthIssue({
    id: "issue-3",
    severity: "info",
    message: "TM-2 heap utilization at 72%",
    source: "memory-monitor",
  }),
]

const bottleneckScores = [
  createBottleneckScore({
    vertexId: "vertex-0",
    vertexName: "Source: Kafka [orders]",
    score: 25,
    severity: "low",
    parallelism: 4,
    factors: { backpressure: 10, busyTime: 30, throughputRatio: 20, skew: 15 },
  }),
  createBottleneckScore({
    vertexId: "vertex-1",
    vertexName: "Map -> Filter -> Watermark",
    score: 45,
    severity: "medium",
    parallelism: 4,
    factors: { backpressure: 40, busyTime: 55, throughputRatio: 45, skew: 30 },
  }),
  createBottleneckScore({
    vertexId: "vertex-2",
    vertexName: "Aggregate: SUM(amount)",
    score: 65,
    severity: "medium",
  }),
  createBottleneckScore({
    vertexId: "vertex-3",
    vertexName: "Sink: Iceberg [order_summary]",
    score: 30,
    severity: "low",
    parallelism: 4,
    factors: { backpressure: 15, busyTime: 35, throughputRatio: 25, skew: 10 },
  }),
]

const dagEdges = [
  createJobEdge({
    source: "vertex-0",
    target: "vertex-1",
    shipStrategy: "FORWARD",
  }),
  createJobEdge({
    source: "vertex-1",
    target: "vertex-2",
    shipStrategy: "HASH",
  }),
  createJobEdge({
    source: "vertex-2",
    target: "vertex-3",
    shipStrategy: "FORWARD",
  }),
]

const healthTrendChartProps: PropDef[] = [
  {
    name: "history",
    type: "HealthSnapshot[]",
    description: "Array of timestamped health scores to plot as an area chart",
  },
]

const subScoreGridProps: PropDef[] = [
  {
    name: "subScores",
    type: "HealthSubScore[]",
    description:
      "Array of named sub-scores (Slot Utilization, Backpressure, etc.)",
  },
]

const topIssuesListProps: PropDef[] = [
  {
    name: "issues",
    type: "HealthIssue[]",
    description: "Active health issues sorted by severity",
  },
  {
    name: "maxItems",
    type: "number",
    default: "10",
    description: "Maximum issues to display before truncating",
  },
]

const bottleneckDAGProps: PropDef[] = [
  {
    name: "scores",
    type: "BottleneckScore[]",
    description: "Per-vertex bottleneck scores with severity",
  },
  {
    name: "edges",
    type: "JobEdge[]",
    description: "Graph edges connecting vertices",
  },
]

const bottleneckTableProps: PropDef[] = [
  {
    name: "scores",
    type: "BottleneckScore[]",
    description: "Per-vertex bottleneck scores displayed in a sortable table",
  },
]

const TOC = [
  { id: "health-trend-chart", label: "HealthTrendChart" },
  { id: "sub-score-grid", label: "SubScoreGrid" },
  { id: "top-issues-list", label: "TopIssuesList" },
  { id: "bottleneck-dag", label: "BottleneckDAG" },
  { id: "bottleneck-table", label: "BottleneckTable" },
]

function InsightsDomainPage() {
  return (
    <ShowcasePage
      title="Insights"
      description="Health trends and bottleneck analysis. 5 components."
      items={TOC}
    >
      <Section
        id="health-trend-chart"
        title="HealthTrendChart"
        description="Area chart showing the overall health score over time."
      >
        <HealthTrendChart history={history} />
        <div className="mt-4">
          <PropsTable props={healthTrendChartProps} />
        </div>
      </Section>

      <Section
        id="sub-score-grid"
        title="SubScoreGrid"
        description="Grid of metric cards for individual health sub-scores."
      >
        <SubScoreGrid subScores={snapshot.subScores} />
        <div className="mt-4">
          <PropsTable props={subScoreGridProps} />
        </div>
      </Section>

      <Section
        id="top-issues-list"
        title="TopIssuesList"
        description="List of active health issues with severity icons and relative timestamps."
      >
        <TopIssuesList issues={issues} />
        <div className="mt-4">
          <PropsTable props={topIssuesListProps} />
        </div>
      </Section>

      <Section
        id="bottleneck-dag"
        title="BottleneckDAG"
        description="ReactFlow DAG visualizing vertex bottleneck severity. Uses ReactFlowProvider internally."
      >
        <BottleneckDAG scores={bottleneckScores} edges={dagEdges} />
        <div className="mt-4">
          <PropsTable props={bottleneckDAGProps} />
        </div>
      </Section>

      <Section
        id="bottleneck-table"
        title="BottleneckTable"
        description="Sortable table of per-vertex bottleneck scores with backpressure level and severity badges."
      >
        <BottleneckTable scores={bottleneckScores} />
        <div className="mt-4">
          <PropsTable props={bottleneckTableProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/insights")({
  component: InsightsDomainPage,
})
