/**
 * Hub-styled ReactFlow edge — near-verbatim copy of the legacy
 * `dashboard/src/components/jobs/detail/strategy-edge.tsx`. The only
 * difference is the label styling: the Hub version renders the strategy
 * label as a small mono pill matching `console-v2/shared/job-dag.js`,
 * while the legacy version uses Tailwind class names.
 *
 * Critically, we pass an explicit inline `style` to <BaseEdge> with a
 * concrete stroke + width — same as legacy. Without this, BaseEdge's
 * <path> falls back to xyflow's CSS variables (which can resolve to a
 * near-invisible #3e3e3e even in dark mode), and the path looks blank
 * even though it's there.
 */
"use client"

import {
  BaseEdge,
  EdgeLabelRenderer,
  type EdgeProps,
  getSmoothStepPath,
} from "@xyflow/react"

type StrategyEdgeData = { shipStrategy: string }

export function HubStrategyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
  markerEnd,
}: EdgeProps & { data?: StrategyEdgeData }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 12,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          stroke: "var(--color-fg-dim)",
          strokeWidth: 1.5,
          ...style,
        }}
      />
      {data?.shipStrategy ? (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan"
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
              background: "rgba(20,22,23,0.92)",
              border: "1px solid var(--color-dash-border)",
              borderRadius: 4,
              padding: "1px 6px",
              fontFamily: "var(--font-mono)",
              fontSize: 9.5,
              color: "var(--color-fg-muted)",
              fontWeight: 500,
              letterSpacing: "0.04em",
              backdropFilter: "blur(4px)",
            }}
          >
            {data.shipStrategy}
          </div>
        </EdgeLabelRenderer>
      ) : null}
    </>
  )
}
