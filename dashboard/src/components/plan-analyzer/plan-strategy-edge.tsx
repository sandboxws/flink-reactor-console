/**
 * @module plan-strategy-edge
 *
 * Custom ReactFlow edge that renders a smooth-step path between plan operators
 * and overlays the shuffle/ship strategy label (e.g., "Hash", "Rebalance").
 * Forward edges suppress the label to reduce visual noise.
 */

import type { EdgeProps } from "@xyflow/react"
import { BaseEdge, EdgeLabelRenderer, getSmoothStepPath } from "@xyflow/react"
import { SHUFFLE_STRATEGY_LABELS } from "@/lib/plan-analyzer/constants"
import type { ShuffleStrategy } from "@/lib/plan-analyzer/types"

/** Edge data carrying the shuffle strategy between two operators. */
type PlanEdgeData = { shipStrategy: ShuffleStrategy }

/**
 * Custom ReactFlow edge with a smooth-step path and a centered strategy label.
 * Forward (1:1) edges hide the label to reduce clutter.
 */
export function PlanStrategyEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  style,
}: EdgeProps & { data?: PlanEdgeData }) {
  const [edgePath, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  })

  const label = data?.shipStrategy
    ? (SHUFFLE_STRATEGY_LABELS[data.shipStrategy] ?? data.shipStrategy)
    : undefined

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
      {label && label !== "Forward (1:1)" && (
        <EdgeLabelRenderer>
          <div
            className="nodrag nopan pointer-events-none absolute rounded bg-dash-elevated px-1.5 py-0.5 text-[9px] font-medium text-zinc-500"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            }}
          >
            {label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  )
}
