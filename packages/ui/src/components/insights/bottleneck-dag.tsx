/** DAG visualization of operator bottlenecks — highlights backpressured and slow operators. */
"use client"

import type { Edge, Node, NodeProps } from "@xyflow/react"
import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from "@xyflow/react"
import { useCallback, useEffect, useMemo } from "react"
import type { BottleneckScore, BottleneckSeverity } from "../../types"
import type { JobEdge } from "../../types"
import { cn } from "../../lib/cn"
import "@xyflow/react/dist/style.css"

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const NODE_WIDTH = 200
const NODE_HEIGHT = 72
const COL_GAP = 60
const ROW_GAP = 32

// ---------------------------------------------------------------------------
// Simple topological layout (reuses job-graph.tsx pattern)
// ---------------------------------------------------------------------------

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
    if (incoming.has(edge.target) && outgoing.has(edge.source)) {
      incoming.get(edge.target)?.add(edge.source)
      outgoing.get(edge.source)?.add(edge.target)
    }
  }

  // Kahn's algorithm for topological layering
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

  // Handle any nodes not reached by topological sort (disconnected)
  const positioned = new Set(colOf.keys())
  for (const node of nodes) {
    if (!positioned.has(node.id)) {
      if (!columns[0]) columns[0] = []
      columns[0].push(node.id)
    }
  }

  // Position: top-to-bottom columns
  const nodeMap = new Map(nodes.map((n) => [n.id, n]))
  const layoutedNodes: Node[] = []

  for (let col = 0; col < columns.length; col++) {
    const ids = columns[col]
    const totalHeight = ids.length * NODE_HEIGHT + (ids.length - 1) * ROW_GAP
    const startY = -totalHeight / 2

    for (let row = 0; row < ids.length; row++) {
      const node = nodeMap.get(ids[row])
      if (!node) continue
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
// Severity color mapping
// ---------------------------------------------------------------------------

const severityStyles: Record<
  BottleneckSeverity,
  { bg: string; border: string; text: string }
> = {
  low: {
    bg: "bg-job-running/10",
    border: "border-job-running/30",
    text: "text-job-running",
  },
  medium: {
    bg: "bg-fr-amber/10",
    border: "border-fr-amber/30",
    text: "text-fr-amber",
  },
  high: {
    bg: "bg-job-failed/10",
    border: "border-job-failed/30",
    text: "text-job-failed",
  },
}

// ---------------------------------------------------------------------------
// Custom bottleneck node
// ---------------------------------------------------------------------------

type BottleneckNodeData = {
  label: string
  parallelism: number
  score: number
  severity: BottleneckSeverity
}

function BottleneckNode({ data }: NodeProps & { data: BottleneckNodeData }) {
  const style = severityStyles[data.severity]

  return (
    <div
      className={cn(
        "flex flex-col gap-1 rounded-lg border px-3 py-2",
        style.bg,
        style.border,
      )}
      style={{ width: NODE_WIDTH }}
    >
      <div className="truncate text-xs font-medium text-zinc-200">
        {data.label}
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-zinc-500">P={data.parallelism}</span>
        <span className={cn("text-xs font-semibold", style.text)}>
          {data.score}
        </span>
      </div>
    </div>
  )
}

const nodeTypes = { bottleneck: BottleneckNode }

// ---------------------------------------------------------------------------
// Inner component (needs ReactFlow context)
// ---------------------------------------------------------------------------

function BottleneckDAGInner({
  scores,
  edges,
}: {
  scores: BottleneckScore[]
  edges: JobEdge[]
}) {
  const { fitView } = useReactFlow()

  const layouted = useMemo(() => {
    // Build a set of vertex IDs present in scores
    const vertexIds = new Set(scores.map((s) => s.vertexId))

    const rawNodes: Node[] = scores.map((s) => ({
      id: s.vertexId,
      type: "bottleneck",
      position: { x: 0, y: 0 },
      data: {
        label: s.vertexName,
        parallelism: s.parallelism,
        score: s.score,
        severity: s.severity,
      },
    }))

    // Only include edges whose source and target are in the scored vertices
    const rawEdges: Edge[] = edges
      .filter((e) => vertexIds.has(e.source) && vertexIds.has(e.target))
      .map((e, i) => ({
        id: `e-${i}`,
        source: e.source,
        target: e.target,
        type: "smoothstep",
        style: { stroke: "var(--color-dash-border)" },
      }))

    return layoutElements(rawNodes, rawEdges)
  }, [scores, edges])

  const [nodes, setNodes, onNodesChange] = useNodesState(layouted.nodes)
  const [rfEdges, setEdges, onEdgesChange] = useEdgesState(layouted.edges)

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
      edges={rfEdges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodeTypes={nodeTypes}
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
// Exported wrapper
// ---------------------------------------------------------------------------

export interface BottleneckDAGProps {
  scores: BottleneckScore[]
  edges: JobEdge[]
}

/** ReactFlow DAG rendering operators as severity-colored nodes with topological layout. */
export function BottleneckDAG({ scores, edges }: BottleneckDAGProps) {
  if (scores.length === 0) {
    return (
      <div className="glass-card flex items-center justify-center py-16 text-sm text-zinc-500">
        No vertices to display
      </div>
    )
  }

  return (
    <div className="glass-card" style={{ height: 400 }}>
      <ReactFlowProvider>
        <BottleneckDAGInner scores={scores} edges={edges} />
      </ReactFlowProvider>
    </div>
  )
}
