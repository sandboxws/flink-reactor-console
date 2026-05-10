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
              <div className="mt-2 h-3 w-full">
                <FlatSparkline />
              </div>
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

/** Flat baseline sparkline placeholder until per-job throughput history lands. */
function FlatSparkline() {
  return (
    <svg
      viewBox="0 0 100 18"
      preserveAspectRatio="none"
      className="h-3 w-full"
      role="img"
      aria-label="throughput sparkline (placeholder)"
    >
      <polyline
        points="0,9 10,9 20,9 30,9 40,9 50,9 60,9 70,9 80,9 90,9 100,9"
        fill="none"
        stroke="var(--color-fr-sage)"
        strokeWidth="1.2"
        opacity="0.4"
      />
    </svg>
  )
}
