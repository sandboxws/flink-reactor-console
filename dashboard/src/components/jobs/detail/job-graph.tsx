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
import type { JobPlan } from "@/data/cluster-types"
import type { TapMetadata } from "@/data/tap-types"
import type { ActiveTapSession } from "@/stores/sql-gateway-store"
import { OperatorNode } from "./operator-node"
import { StrategyEdge } from "./strategy-edge"
import "@xyflow/react/dist/style.css"

// ---------------------------------------------------------------------------
// Simple top-to-bottom layout (replaces dagre — our graphs are linear DAGs)
// ---------------------------------------------------------------------------

const NODE_WIDTH = 320
const NODE_HEIGHT = 170
const COL_GAP = 80
const ROW_GAP = 50

function layoutElements(
  nodes: Node[],
  edges: Edge[],
): { nodes: Node[]; edges: Edge[] } {
  // Build adjacency for topological layering
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

  // Topological layer assignment via BFS (Kahn's algorithm)
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

  // Position nodes: left-to-right columns, center each column vertically
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
// Node & edge type registrations (stable references)
// ---------------------------------------------------------------------------

const nodeTypes = { operator: OperatorNode }
const edgeTypes = { strategy: StrategyEdge }

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlow context)
// ---------------------------------------------------------------------------

function JobGraphInner({
  plan,
  onSelectVertex,
  tapMetadataByVertex,
  tapSessionStatuses,
  onTapInto,
  onStopTap,
}: {
  plan: JobPlan
  onSelectVertex?: (vertexId: string) => void
  tapMetadataByVertex?: Map<string, TapMetadata>
  tapSessionStatuses?: Record<string, ActiveTapSession["status"]>
  onTapInto?: (vertexName: string) => void
  onStopTap?: (vertexName: string) => void
}) {
  const { fitView } = useReactFlow()

  const layouted = useMemo(() => {
    const rawNodes: Node[] = plan.vertices.map((v) => {
      const tapMeta = tapMetadataByVertex?.get(v.name)
      const tapStatus = tapMeta
        ? tapSessionStatuses?.[tapMeta.nodeId]
        : undefined
      return {
        id: v.id,
        type: "operator",
        position: { x: 0, y: 0 },
        data: {
          vertex: v,
          onSelectVertex,
          tapMetadata: tapMeta,
          tapSessionStatus: tapStatus,
          onTapInto,
          onStopTap,
        },
      }
    })

    const rawEdges: Edge[] = plan.edges.map((e, i) => ({
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      type: "strategy",
      data: { shipStrategy: e.shipStrategy },
    }))

    return layoutElements(rawNodes, rawEdges)
  }, [
    plan,
    onSelectVertex,
    tapMetadataByVertex,
    tapSessionStatuses,
    onTapInto,
    onStopTap,
  ])

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges)

  // Re-layout when plan changes
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
      {plan.vertices.length >= 5 && (
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

export function JobGraph({
  plan,
  className,
  onSelectVertex,
  tapMetadataByVertex,
  tapSessionStatuses,
  onTapInto,
  onStopTap,
}: {
  plan: JobPlan
  className?: string
  onSelectVertex?: (vertexId: string) => void
  tapMetadataByVertex?: Map<string, TapMetadata>
  tapSessionStatuses?: Record<string, ActiveTapSession["status"]>
  onTapInto?: (vertexName: string) => void
  onStopTap?: (vertexName: string) => void
}) {
  return (
    <div className={`glass-card ${className ?? ""}`} style={{ height: 500 }}>
      <ReactFlowProvider>
        <JobGraphInner
          plan={plan}
          onSelectVertex={onSelectVertex}
          tapMetadataByVertex={tapMetadataByVertex}
          tapSessionStatuses={tapSessionStatuses}
          onTapInto={onTapInto}
          onStopTap={onStopTap}
        />
      </ReactFlowProvider>
    </div>
  )
}
