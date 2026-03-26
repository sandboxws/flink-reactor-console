import type {
  AnalyzedFlinkPlan,
  FlinkAntiPattern,
  FlinkOperatorNode,
  StateGrowthForecast,
} from "@flink-reactor/ui"
import {
  PlanAntiPatternCard,
  PlanDAG,
  PlanStateForecast,
} from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

// Build a minimal analyzed plan for demo purposes
const sinkNode: FlinkOperatorNode = {
  id: "node-3",
  nodeType: "Sink",
  operation: "Sink: Iceberg [order_summary]",
  operatorType: "Sink",
  category: "sink",
  parallelism: 4,
  inputs: [
    {
      operatorId: "node-2",
      shipStrategy: "FORWARD",
      exchangeMode: "pipelined",
    },
  ],
  children: [],
  rawData: {},
  changelogMode: "UPSERT",
}

const aggNode: FlinkOperatorNode = {
  id: "node-2",
  nodeType: "GroupAggregate",
  operation: "GroupAggregate(groupBy=[customer_id], select=[SUM(amount)])",
  operatorType: "GroupAggregate",
  category: "aggregation",
  parallelism: 4,
  groupByKeys: ["customer_id"],
  inputs: [
    { operatorId: "node-1", shipStrategy: "HASH", exchangeMode: "pipelined" },
  ],
  children: [],
  rawData: {},
}

const filterNode: FlinkOperatorNode = {
  id: "node-1",
  nodeType: "Calc",
  operation: "Calc(select=[order_id, customer_id, amount], where=[amount > 0])",
  operatorType: "Calc",
  category: "transformation",
  parallelism: 4,
  inputs: [
    {
      operatorId: "node-0",
      shipStrategy: "FORWARD",
      exchangeMode: "pipelined",
    },
  ],
  children: [],
  rawData: {},
}

const sourceNode: FlinkOperatorNode = {
  id: "node-0",
  nodeType: "TableSourceScan",
  operation: "Source: Kafka [orders]",
  operatorType: "TableSourceScan",
  category: "source",
  parallelism: 4,
  inputs: [],
  children: [],
  rawData: {},
}

// Wire up child references (children point downstream -> upstream in Flink plan)
sinkNode.children = [aggNode]
aggNode.children = [filterNode]
filterNode.children = [sourceNode]

const antiPatterns: FlinkAntiPattern[] = [
  {
    id: "ap-1",
    nodeId: "node-2",
    severity: "warning",
    type: "unbounded-state-aggregate",
    title: "Unbounded State Aggregate",
    description:
      "GroupAggregate on customer_id without TTL will accumulate state for every distinct key indefinitely.",
    suggestion: "Configure state TTL to bound state growth.",
    flinkConfig: "table.exec.state.ttl = 86400000",
  },
  {
    id: "ap-2",
    nodeId: "node-2",
    severity: "info",
    type: "hash-before-skew",
    title: "Hash Shuffle Before Aggregation",
    description:
      "HASH shuffle on customer_id may cause skew if key distribution is uneven.",
    suggestion:
      "Consider enabling local-global aggregation to pre-aggregate locally before shuffle.",
    flinkConfig:
      "table.exec.mini-batch.enabled = true\ntable.exec.mini-batch.allow-latency = 5s\ntable.exec.mini-batch.size = 5000",
  },
]

const stateForecasts: StateGrowthForecast[] = [
  {
    operatorId: "node-2",
    operatorName: "GroupAggregate(SUM(amount))",
    stateType: "MapState",
    growthPattern: "linear",
    estimatedSize1h: 52_428_800,
    estimatedSize24h: 1_073_741_824,
    estimatedSize7d: 7_516_192_768,
    ttlConfigured: false,
    warning:
      "State will grow linearly with distinct customer_id count. Consider configuring TTL.",
  },
]

const plan: AnalyzedFlinkPlan = {
  id: "plan-001",
  name: "ecommerce-order-enrichment",
  createdAt: Date.now(),
  root: sinkNode,
  totalNodes: 4,
  maxDepth: 4,
  rawPlan: {},
  format: "json",
  jobType: "STREAMING",
  stateForecasts,
  watermarkHealth: [],
  antiPatterns,
  bottlenecks: [],
  recommendations: [],
  workloadType: "OLTP",
  criticalPath: ["node-0", "node-1", "node-2", "node-3"],
  totalEstimatedState24h: 1_073_741_824,
  totalEstimatedState7d: 7_516_192_768,
}

const planDAGProps: PropDef[] = [
  {
    name: "plan",
    type: "AnalyzedFlinkPlan",
    description:
      "The full analyzed plan object with operators, edges, anti-patterns, and forecasts",
  },
  {
    name: "selectedNodeId",
    type: "string | null",
    default: "null",
    description: "Currently selected node ID (highlights in the graph)",
  },
  {
    name: "onNodeSelect",
    type: "(nodeId: string | null) => void",
    default: "undefined",
    description: "Called when a node is clicked for selection",
  },
  {
    name: "className",
    type: "string",
    default: "undefined",
    description: "Additional CSS classes for the container",
  },
]

const planAntiPatternCardProps: PropDef[] = [
  {
    name: "antiPattern",
    type: "FlinkAntiPattern",
    description:
      "Anti-pattern with severity, title, description, suggestion, and optional code fixes",
  },
]

const planStateForecastProps: PropDef[] = [
  {
    name: "forecasts",
    type: "StateGrowthForecast[]",
    description: "Array of state growth forecasts per stateful operator",
  },
]

const TOC = [
  { id: "plan-dag", label: "PlanDAG" },
  { id: "plan-nodes", label: "PlanOperatorNode / PlanStrategyEdge" },
  { id: "plan-anti-pattern-card", label: "PlanAntiPatternCard" },
  { id: "plan-state-forecast", label: "PlanStateForecast" },
]

/** Showcase route: /domain/plan-analyzer -- Showcases plan analyzer components (PlanDAG, PlanAntiPatternCard, PlanStateForecast) with fixture data. */
function PlanAnalyzerDomainPage() {
  return (
    <ShowcasePage
      title="Plan Analyzer"
      description="Query plan visualization and analysis. 5 components."
      items={TOC}
    >
      <Section
        id="plan-dag"
        title="PlanDAG"
        description="Interactive ReactFlow DAG of the analyzed query plan. Uses ReactFlowProvider internally."
      >
        <div className="h-[400px]">
          <PlanDAG plan={plan} onNodeSelect={(_id) => {}} className="h-full" />
        </div>
        <div className="mt-4">
          <PropsTable props={planDAGProps} />
        </div>
      </Section>

      <Section
        id="plan-nodes"
        title="PlanOperatorNode / PlanStrategyEdge"
        description="Custom ReactFlow node and edge types used within the PlanDAG."
      >
        <div className="glass-card p-4">
          <p className="text-sm text-fg-muted">
            <strong>PlanOperatorNode</strong> renders operator details (category
            badge, parallelism, group-by keys, state forecast, anti-pattern
            badges) inside the DAG graph. <strong>PlanStrategyEdge</strong>{" "}
            renders shuffle strategy labels on edges between operators.
          </p>
          <p className="mt-2 text-sm text-fg-muted">
            Both are @xyflow/react custom types and require a ReactFlow context.
            They cannot be rendered standalone. See the PlanDAG demo above for
            their visual appearance.
          </p>
        </div>
      </Section>

      <Section
        id="plan-anti-pattern-card"
        title="PlanAntiPatternCard"
        description="Card showing an identified anti-pattern with severity, description, suggestion, and code fixes."
      >
        <div className="flex flex-col gap-3 max-w-2xl">
          {antiPatterns.map((ap) => (
            <PlanAntiPatternCard key={ap.id} antiPattern={ap} />
          ))}
        </div>
        <div className="mt-4">
          <PropsTable props={planAntiPatternCardProps} />
        </div>
      </Section>

      <Section
        id="plan-state-forecast"
        title="PlanStateForecast"
        description="State growth forecast cards showing 1h/24h/7d estimates with growth pattern badges."
      >
        <div className="max-w-lg">
          <PlanStateForecast forecasts={stateForecasts} />
        </div>
        <div className="mt-4">
          <PropsTable props={planStateForecastProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/plan-analyzer")({
  component: PlanAnalyzerDomainPage,
})
