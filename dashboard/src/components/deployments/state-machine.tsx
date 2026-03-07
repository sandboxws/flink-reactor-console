import {
  Background,
  BackgroundVariant,
  type Edge,
  type Node,
  Position,
  ReactFlow,
} from "@xyflow/react"
import "@xyflow/react/dist/style.css"
import type { BlueGreenState } from "@/data/bg-deployment-types"
import { getStateBadgeColor } from "@/data/bg-deployment-types"

const STATE_NODES: Array<{
  id: BlueGreenState
  label: string
  x: number
  y: number
}> = [
  { id: "INITIALIZING_BLUE", label: "Init Blue", x: 50, y: 150 },
  { id: "ACTIVE_BLUE", label: "Active Blue", x: 250, y: 50 },
  { id: "SAVEPOINTING_BLUE", label: "Savepoint Blue", x: 450, y: 50 },
  { id: "TRANSITIONING_TO_GREEN", label: "→ Green", x: 650, y: 50 },
  { id: "ACTIVE_GREEN", label: "Active Green", x: 250, y: 250 },
  { id: "SAVEPOINTING_GREEN", label: "Savepoint Green", x: 450, y: 250 },
  { id: "TRANSITIONING_TO_BLUE", label: "→ Blue", x: 650, y: 250 },
]

const STATE_EDGES: Array<{ source: BlueGreenState; target: BlueGreenState }> = [
  { source: "INITIALIZING_BLUE", target: "ACTIVE_BLUE" },
  { source: "ACTIVE_BLUE", target: "SAVEPOINTING_BLUE" },
  { source: "SAVEPOINTING_BLUE", target: "TRANSITIONING_TO_GREEN" },
  { source: "TRANSITIONING_TO_GREEN", target: "ACTIVE_GREEN" },
  { source: "ACTIVE_GREEN", target: "SAVEPOINTING_GREEN" },
  { source: "SAVEPOINTING_GREEN", target: "TRANSITIONING_TO_BLUE" },
  { source: "TRANSITIONING_TO_BLUE", target: "ACTIVE_BLUE" },
]

const nodeColorMap: Record<string, { bg: string; border: string }> = {
  green: { bg: "#10b981", border: "#059669" },
  amber: { bg: "#f59e0b", border: "#d97706" },
  blue: { bg: "#0ea5e9", border: "#0284c7" },
  gray: { bg: "#71717a", border: "#52525b" },
}

interface StateMachineProps {
  currentState: BlueGreenState
}

export function StateMachine({ currentState }: StateMachineProps) {
  const nodes: Node[] = STATE_NODES.map((s) => {
    const isActive = s.id === currentState
    const color = getStateBadgeColor(s.id)
    const colors = nodeColorMap[color]

    return {
      id: s.id,
      position: { x: s.x, y: s.y },
      data: { label: s.label },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: isActive ? colors.bg : "rgba(39,39,42,0.8)",
        color: isActive ? "#fff" : "#a1a1aa",
        border: `2px solid ${isActive ? colors.border : "#3f3f46"}`,
        borderRadius: "8px",
        padding: "8px 16px",
        fontSize: "12px",
        fontWeight: isActive ? 600 : 400,
        boxShadow: isActive ? `0 0 12px ${colors.bg}40` : "none",
      },
    }
  })

  const edges: Edge[] = STATE_EDGES.map((e, i) => {
    // Determine if this edge has been traversed (comes before current state in the cycle)
    const currentIdx = STATE_NODES.findIndex((n) => n.id === currentState)
    const sourceIdx = STATE_NODES.findIndex((n) => n.id === e.source)
    const isCompleted = sourceIdx < currentIdx

    return {
      id: `e-${i}`,
      source: e.source,
      target: e.target,
      animated: e.source === currentState,
      style: {
        stroke: isCompleted ? "#10b981" : "#3f3f46",
        strokeWidth: isCompleted || e.source === currentState ? 2 : 1,
        strokeDasharray: isCompleted ? undefined : "5 5",
      },
    }
  })

  return (
    <div className="h-[280px] w-full rounded-lg border border-dash-border bg-dash-surface">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        fitView
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnDoubleClick={false}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="#27272a"
        />
      </ReactFlow>
    </div>
  )
}
