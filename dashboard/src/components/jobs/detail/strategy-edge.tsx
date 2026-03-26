/**
 * @module strategy-edge
 *
 * Custom ReactFlow edge that renders a smooth-step path between operator nodes
 * with an inline label showing the Flink ship/partitioning strategy
 * (e.g. FORWARD, HASH, REBALANCE).
 */

import type { EdgeProps } from "@xyflow/react"
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react"

/** Edge data carrying the Flink partitioning strategy label. */
type StrategyEdgeData = { shipStrategy: string }

/**
 * Custom ReactFlow edge rendering a smooth-step path with an optional
 * ship strategy label (FORWARD, HASH, REBALANCE, etc.) positioned at the midpoint.
 */
export function StrategyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps & { data?: StrategyEdgeData }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  })

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        style={{
          stroke: "var(--color-dash-border)",
          strokeWidth: 1.5,
          ...style,
        }}
      />
      {data?.shipStrategy && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-dash-elevated px-1.5 py-0.5 text-[9px] font-medium text-zinc-500"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {data.shipStrategy}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
