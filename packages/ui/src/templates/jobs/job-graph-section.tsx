"use client"

/**
 * JobGraphSection — Plan vertices and edges visualization.
 *
 * A lightweight template that renders job plan vertices and edges
 * as a structured list. The full ReactFlow DAG (OperatorNode + StrategyEdge)
 * requires @xyflow/react and lazy loading, so this template provides a
 * practical table-based fallback that works without additional dependencies.
 *
 * Accepts pure data props — no stores, no router.
 */

import { GitBranch, ArrowRight } from "lucide-react"
import type { FlinkJob, ShipStrategy } from "../../types"
import { cn } from "../../lib/cn"
import { EmptyState } from "../../shared/empty-state"

// ---------------------------------------------------------------------------
// Ship strategy badge
// ---------------------------------------------------------------------------

const strategyColors: Record<ShipStrategy, string> = {
  FORWARD: "bg-job-running/15 text-job-running",
  HASH: "bg-fr-purple/15 text-fr-purple",
  REBALANCE: "bg-fr-amber/15 text-fr-amber",
  BROADCAST: "bg-fr-coral/15 text-fr-coral",
  RESCALE: "bg-blue-500/15 text-blue-400",
  GLOBAL: "bg-zinc-500/15 text-zinc-400",
}

function StrategyBadge({ strategy }: { strategy: ShipStrategy }) {
  return (
    <span
      className={cn(
        "rounded px-1.5 py-0.5 text-[10px] font-medium uppercase",
        strategyColors[strategy],
      )}
    >
      {strategy}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Vertex status dot
// ---------------------------------------------------------------------------

const statusDotColor: Record<string, string> = {
  RUNNING: "bg-job-running",
  FINISHED: "bg-job-finished",
  FAILED: "bg-job-failed",
  CANCELED: "bg-job-cancelled",
  CREATED: "bg-job-created",
}

// ---------------------------------------------------------------------------
// JobGraphSection
// ---------------------------------------------------------------------------

/** Renders the job graph section with plan vertices and data edges as a structured list. */
export function JobGraphSection({ job }: { job: FlinkJob }) {
  const plan = job.plan
  if (!plan || plan.vertices.length === 0) {
    return <EmptyState message="No execution plan available" />
  }

  const vertexMap = new Map(plan.vertices.map((v) => [v.id, v]))

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2 text-zinc-400">
        <GitBranch className="size-4" />
        <h3 className="text-sm font-medium text-zinc-200">Execution Plan</h3>
        <span className="text-xs text-zinc-500">
          {plan.vertices.length} operators &middot; {plan.edges.length} edges
        </span>
      </div>

      {/* Vertices */}
      <div className="flex flex-col gap-2">
        {plan.vertices.map((v, i) => (
          <div key={v.id} className="glass-card p-3">
            <div className="flex items-center gap-3">
              <span className="flex size-6 items-center justify-center rounded-full bg-fr-purple/15 text-[10px] font-medium text-fr-purple">
                {i + 1}
              </span>
              <div
                className={cn(
                  "size-2 rounded-full",
                  statusDotColor[v.status] ?? "bg-zinc-500",
                )}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-zinc-200">
                  {v.name}
                </p>
              </div>
              <span className="text-xs text-zinc-500">
                p={v.parallelism}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Edges */}
      {plan.edges.length > 0 && (
        <div className="flex flex-col gap-1">
          <h4 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Data Edges
          </h4>
          {plan.edges.map((edge, i) => {
            const src = vertexMap.get(edge.source)
            const tgt = vertexMap.get(edge.target)
            return (
              <div
                key={`${edge.source}-${edge.target}-${i}`}
                className="flex items-center gap-2 rounded-lg bg-dash-surface px-3 py-1.5 text-xs text-zinc-400"
              >
                <span className="truncate">
                  {src?.name ?? edge.source}
                </span>
                <ArrowRight className="size-3 shrink-0 text-zinc-600" />
                <span className="truncate">
                  {tgt?.name ?? edge.target}
                </span>
                <StrategyBadge strategy={edge.shipStrategy} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
