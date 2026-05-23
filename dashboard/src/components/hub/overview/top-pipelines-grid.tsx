/**
 * Top pipelines — horizontal grid of glass-cards (4 across at lg) showing
 * the first N running jobs. Each tile links to `/hub/jobs/$id`.
 *
 * The throughput value renders as "—" until per-job rate metrics ship.
 */

import { type FlinkJob, LiveDot } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { ArrowRight } from "lucide-react"

interface TopPipelinesGridProps {
  pipelines: FlinkJob[]
  totalRunningCount: number
}

export function TopPipelinesGrid({
  pipelines,
  totalRunningCount,
}: TopPipelinesGridProps) {
  return (
    <section className="mb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-sans text-[16px] font-medium text-zinc-100">
          Top pipelines
        </h2>
        <Link
          to="/hub/jobs/running"
          className="flex items-center gap-1 text-[12px] text-fr-coral hover:underline"
        >
          View all {totalRunningCount}
          <ArrowRight className="size-3" />
        </Link>
      </div>
      {pipelines.length === 0 ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fg-muted">
          No running pipelines.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {pipelines.map((job) => (
            <Link
              key={job.id}
              to="/hub/jobs/$id"
              params={{ id: job.id }}
              className="glass-card p-4 block"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-sans text-[13px] font-medium text-zinc-100 truncate">
                  {job.name}
                </span>
                <span className="status-pill running shrink-0">
                  <LiveDot />
                  Running
                </span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="font-mono text-[20px] text-fg">—</span>
                <span className="text-[10px] text-fg-muted font-mono">
                  evt/s
                </span>
              </div>
              {/* Sparkline placeholder removed — wire real per-job throughput
                 history when fr-console-v2-server-job-throughput-rollup lands. */}
              <div className="mt-2 flex items-center justify-between text-[10px] font-mono text-fg-faint">
                <span>
                  {Object.values(job.tasks).reduce((a, b) => a + b, 0)} tasks
                </span>
                <span>p{job.parallelism}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </section>
  )
}

