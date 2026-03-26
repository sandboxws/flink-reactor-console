/**
 * @module plan-dag
 *
 * Interactive DAG visualization of a Flink execution plan using ReactFlow.
 * Flattens the {@link AnalyzedFlinkPlan} operator tree into positioned nodes
 * and edges using Kahn's topological sort, then renders them with custom
 * {@link PlanOperatorNode} and {@link PlanStrategyEdge} components.
 */

import type { Edge, Node } from "@xyflow/react"
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
import type {
  AnalyzedFlinkPlan,
  FlinkAntiPattern,
  FlinkOperatorNode,
  StateGrowthForecast,
} from "@/lib/plan-analyzer/types"
import type { PlanOperatorNodeData } from "./plan-operator-node"
import { PlanOperatorNode } from "./plan-operator-node"
import { PlanStrategyEdge } from "./plan-strategy-edge"
import "@xyflow/react/dist/style.css"

// ---------------------------------------------------------------------------
// Layout — same Kahn's algorithm as job-graph.tsx
// ---------------------------------------------------------------------------

const NODE_WIDTH = 320
const NODE_HEIGHT = 170
const COL_GAP = 80
const ROW_GAP = 50

/**
 * Assigns x/y positions to nodes using Kahn's topological sort.
 * Sources are placed in column 0, downstream operators in successive columns.
 * Nodes within a column are vertically centered.
 */
function layoutElements(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  const incoming = new Map<string, Set<string>>()
  const outgoing = new Map<string, Set<string>>()
  for (const node of nodes) {
    incoming.set(node.id, new Set())
    outgoing.set(node.id, new Set())
  }
  for (const edge of edges) {
    incoming.get(edge.target)?.add(edge.source)
    outgoing.get(edge.source)?.add(edge.target)
  }

  const columns: string[][] = []
  const colOf = new Map<string, number>()
  const queue: string[] = []

  for (const node of nodes) {
    if (incoming.get(node.id)?.size === 0) {
      queue.push(node.id)
      colOf.set(node.id, 0)
    }
  }

  while (queue.length > 0) {
    const id = queue.shift()!
    const col = colOf.get(id)!
    if (!columns[col]) columns[col] = []
    columns[col].push(id)

    for (const target of outgoing.get(id) ?? []) {
      const targetIn = incoming.get(target)!
      targetIn.delete(id)
      if (targetIn.size === 0) {
        colOf.set(target, col + 1)
        queue.push(target)
      }
    }
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const layoutedNodes: Node[] = []

  for (let col = 0; col < columns.length; col++) {
    const ids = columns[col]
    const totalHeight = ids.length * NODE_HEIGHT + (ids.length - 1) * ROW_GAP
    const startY = -totalHeight / 2

    for (let row = 0; row < ids.length; row++) {
      const node = nodeMap.get(ids[row])!
      layoutedNodes.push({
        ...node,
        position: {
          x: col * (NODE_WIDTH + COL_GAP),
          y: startY + row * (NODE_HEIGHT + ROW_GAP),
        },
      })
    }
  }

  return { nodes: layoutedNodes, edges }
}

// ---------------------------------------------------------------------------
// Flatten plan tree into nodes + edges
// ---------------------------------------------------------------------------

/**
 * Recursively traverses the plan operator tree and produces flat arrays of
 * ReactFlow nodes and edges. Anti-patterns and state forecasts are indexed
 * by operator ID and attached to each node's data payload.
 */
function flattenPlan(
  plan: AnalyzedFlinkPlan,
  selectedNodeId: string | null,
  onSelect?: (nodeId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = []
  const edges: Edge[] = []
  const visited = new Set<string>()

  // Index anti-patterns and forecasts by node ID
  const antiPatternsByNode = new Map<string, FlinkAntiPattern[]>()
  for (const ap of plan.antiPatterns) {
    const list = antiPatternsByNode.get(ap.nodeId) ?? []
    list.push(ap)
    antiPatternsByNode.set(ap.nodeId, list)
  }

  const forecastsByNode = new Map<string, StateGrowthForecast[]>()
  for (const sf of plan.stateForecasts) {
    const list = forecastsByNode.get(sf.operatorId) ?? []
    list.push(sf)
    forecastsByNode.set(sf.operatorId, list)
  }

  function traverse(opNode: FlinkOperatorNode) {
    if (visited.has(opNode.id)) return
    visited.add(opNode.id)

    // Skip virtual root — just traverse its children
    if (opNode.id === "virtual-root") {
      for (const child of opNode.children) {
        traverse(child)
      }
      return
    }

    const nodeData: PlanOperatorNodeData = {
      node: opNode,
      antiPatterns: antiPatternsByNode.get(opNode.id) ?? [],
      stateForecasts: forecastsByNode.get(opNode.id) ?? [],
      isSelected: opNode.id === selectedNodeId,
      onSelect,
    }

    nodes.push({
      id: opNode.id,
      type: "planOperator",
      position: { x: 0, y: 0 },
      data: nodeData,
    })

    // Edges: children are upstream (source → this node)
    for (const child of opNode.children) {
      traverse(child)

      // Find the input entry for this child to get ship strategy
      const input = opNode.inputs.find((i) => i.operatorId === child.id)

      edges.push({
        id: `e-${child.id}-${opNode.id}`,
        source: child.id,
        target: opNode.id,
        type: "planStrategy",
        data: { shipStrategy: input?.shipStrategy ?? "FORWARD" },
      })
    }
  }

  traverse(plan.root)
  return { nodes, edges }
}

// ---------------------------------------------------------------------------
// Node & edge type registrations (stable references)
// ---------------------------------------------------------------------------

const nodeTypes = { planOperator: PlanOperatorNode }
const edgeTypes = { planStrategy: PlanStrategyEdge }

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlow context)
// ---------------------------------------------------------------------------

/** Inner component that requires ReactFlow context for `fitView`. */
function PlanDAGInner({
  plan,
  selectedNodeId,
  onNodeSelect,
}: {
  plan: AnalyzedFlinkPlan
  selectedNodeId?: string | null
  onNodeSelect?: (nodeId: string | null) => void
}) {
  const { fitView } = useReactFlow()

  const layouted = useMemo(() => {
    const { nodes: rawNodes, edges: rawEdges } = flattenPlan(
      plan,
      selectedNodeId ?? null,
      onNodeSelect ?? undefined,
    )
    return layoutElements(rawNodes, rawEdges)
  }, [plan, selectedNodeId, onNodeSelect])

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges)

  useEffect(() => {
    setNodes(layouted.nodes)
    setEdges(layouted.edges)
    requestAnimationFrame(() => fitView({ padding: 0.2 }))
  }, [layouted, setNodes, setEdges, fitView])

  const onInit = useCallback(() => {
    fitView({ padding: 0.2 })
  }, [fitView])

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={onInit}
      fitView
      minZoom={0.3}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      proOptions={{ hideAttribution: true }}
    >
      <Controls
        showInteractive={false}
        className="!bg-dash-panel !border-dash-border !rounded-md !shadow-none [&>button]:!bg-dash-panel [&>button]:!border-dash-border [&>button]:!fill-zinc-400 [&>button:hover]:!bg-dash-hover"
      />
      {nodes.length >= 5 && (
        <MiniMap
          nodeColor="var(--color-dash-elevated)"
          maskColor="rgba(10,10,15,0.8)"
          className="!bg-dash-panel !border-dash-border !rounded-md"
        />
      )}
      <Background
        variant={BackgroundVariant.Dots}
        gap={20}
        size={1}
        color="var(--color-dash-border)"
      />
    </ReactFlow>
  )
}

// ---------------------------------------------------------------------------
// Exported wrapper with provider
// ---------------------------------------------------------------------------

/**
 * Execution plan DAG visualization with zoom controls and minimap.
 *
 * Wraps ReactFlow in a provider and delegates layout/rendering to
 * {@link PlanDAGInner}. The minimap is shown when the graph has 5+ nodes.
 */
export function PlanDAG({
  plan,
  selectedNodeId,
  onNodeSelect,
  className,
}: {
  plan: AnalyzedFlinkPlan
  selectedNodeId?: string | null
  onNodeSelect?: (nodeId: string | null) => void
  className?: string
}) {
  return (
    <div className={`min-h-0 flex-1 ${className ?? ""}`}>
      <ReactFlowProvider>
        <PlanDAGInner
          plan={plan}
          selectedNodeId={selectedNodeId}
          onNodeSelect={onNodeSelect}
        />
      </ReactFlowProvider>
    </div>
  )
}
