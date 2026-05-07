/**
 * Hub job DAG — pattern-mirrored from `dashboard/src/components/jobs/detail/job-graph.tsx`.
 *
 * The legacy `JobGraph` is the proven path: it uses `useNodesState`+`useEdgesState`
 * with `onNodesChange`/`onEdgesChange` so xyflow can measure node DOM and compute
 * edge endpoints correctly. We swap only the node + edge renderers to the Hub
 * variants (`HubOperatorNode` + `HubStrategyEdge`); everything else stays
 * identical to legacy so edge wiring "just works".
 *
 * The mockup contract (320×170 operator cards, Kahn topological columns,
 * smooth-step edges with strategy labels) is satisfied by the same
 * `layoutElements` pipeline the legacy uses — same dimensions, same algo.
 */
"use client"

import type { JobPlan } from "@flink-reactor/ui"
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
import { HubOperatorNode } from "./hub-operator-node"
import { HubStrategyEdge } from "./hub-strategy-edge"
import "@xyflow/react/dist/style.css"

/* Match dashboard / mockup contract exactly. */
const NODE_WIDTH = 320
const NODE_HEIGHT = 170
const COL_GAP = 80
const ROW_GAP = 50

/**
 * Topological layer assignment via Kahn's algorithm (BFS), then position
 * left-to-right by column, vertically centered within each column.
 * Direct port of the legacy `job-graph.tsx` `layoutElements` — keeping the
 * algo identical guarantees the same plan data lays out the same way.
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

const nodeTypes = { hubOperator: HubOperatorNode }
const edgeTypes = { hubStrategy: HubStrategyEdge }

interface HubJobGraphProps {
  plan: JobPlan
  selectedVertexId?: string
  onSelectVertex?: (id: string) => void
  className?: string
}

function HubJobGraphInner({
  plan,
  selectedVertexId,
  onSelectVertex,
}: HubJobGraphProps) {
  const { fitView } = useReactFlow()

  const layouted = useMemo(() => {
    /* Build raw nodes/edges for layout. */
    const rawNodes: Node[] = plan.vertices.map((v) => ({
      id: v.id,
      type: "hubOperator",
      position: { x: 0, y: 0 },
      data: { vertex: v, onSelectVertex },
      selected: v.id === selectedVertexId,
      draggable: true,
    }))

    /* "Hot" edges (sourced from busy ≥300ms/s vertex) animate dashed. */
    const hotMap = new Map<string, boolean>()
    for (const v of plan.vertices) {
      hotMap.set(v.id, (v.metrics.busyTimeMsPerSecond ?? 0) >= 300)
    }
    const rawEdges: Edge[] = plan.edges.map((e, i) => ({
      id: `e-${i}-${e.source}-${e.target}`,
      source: e.source,
      target: e.target,
      type: "hubStrategy",
      data: { shipStrategy: e.shipStrategy ?? "FORWARD" },
      animated: !!hotMap.get(e.source),
    }))

    return layoutElements(rawNodes, rawEdges)
  }, [plan, selectedVertexId, onSelectVertex])

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(layouted.edges)

  /* Re-layout when plan changes — same dance as legacy. */
  useEffect(() => {
    setNodes(layouted.nodes)
    setEdges(layouted.edges)
    requestAnimationFrame(() => fitView({ padding: 0.2 }))
  }, [layouted, setNodes, setEdges, fitView])

  const onInit = useCallback(() => {
    fitView({ padding: 0.2 })
  }, [fitView])

  const onNodeClick = useCallback(
    (_e: unknown, node: Node) => {
      onSelectVertex?.(node.id)
    },
    [onSelectVertex],
  )

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onNodeClick={onNodeClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      onInit={onInit}
      fitView
      minZoom={0.3}
      maxZoom={2}
      nodesDraggable={false}
      nodesConnectable={false}
      colorMode="dark"
      proOptions={{ hideAttribution: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={24} size={1.2} />
      <Controls showInteractive={false} position="bottom-right" />
      {plan.vertices.length >= 5 ? (
        <MiniMap
          pannable
          zoomable
          position="top-right"
          nodeColor={(n) => {
            const data = n.data as {
              vertex?: { metrics?: { busyTimeMsPerSecond?: number } }
            }
            const busy = data.vertex?.metrics?.busyTimeMsPerSecond ?? 0
            if (busy >= 600) return "#ea6962"
            if (busy >= 300) return "#d8a657"
            return "#a9b665"
          }}
          nodeStrokeColor="var(--color-dash-border)"
          maskColor="rgba(16, 18, 19, 0.7)"
        />
      ) : null}
    </ReactFlow>
  )
}

export function HubJobGraph({ className, ...props }: HubJobGraphProps) {
  return (
    <div className={`fr-dag-mount ${className ?? ""}`}>
      <ReactFlowProvider>
        <HubJobGraphInner {...props} />
      </ReactFlowProvider>
    </div>
  )
}
