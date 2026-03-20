import { formatDistanceToNow } from "date-fns"
import { Badge } from "@/components/ui/badge"
import type { SimulationRun } from "@/lib/graphql-api-client"
import { cn } from "@/lib/cn"

const metricColors: Record<string, string> = {
  throughput: "text-job-running",
  checkpoint_duration: "text-fr-amber",
  checkpoint_size: "text-fr-amber",
  backpressure_pct: "text-job-failed",
  restart_count: "text-job-failed",
  watermark_lag: "text-fr-purple",
  status: "text-zinc-400",
  elapsed_sec: "text-zinc-500",
}

const statusColors: Record<string, string> = {
  PENDING: "bg-zinc-500/15 text-zinc-400",
  RUNNING: "bg-job-running/15 text-job-running",
  COMPLETED: "bg-job-finished/15 text-job-finished",
  FAILED: "bg-job-failed/15 text-job-failed",
  CANCELLED: "bg-job-cancelled/15 text-job-cancelled",
}

export function SimulationRunTimeline({ run }: { run: SimulationRun }) {
  return (
    <div className="flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">{run.scenario}</h3>
          <p className="text-[10px] text-zinc-500">
            Started{" "}
            {formatDistanceToNow(new Date(run.startedAt), { addSuffix: true })}
          </p>
        </div>
        <Badge
          variant="outline"
          className={cn(
            "border-0 text-xs",
            statusColors[run.status] ?? "bg-zinc-500/15 text-zinc-400",
          )}
        >
          {run.status}
        </Badge>
      </div>

      {/* Timeline */}
      {(run.observations ?? []).length === 0 ? (
        <div className="text-xs text-zinc-500 text-center py-4">
          No observations yet
        </div>
      ) : (
        <div className="space-y-1">
          {(run.observations ?? []).map((obs, i) => (
            <div
              key={`${obs.timestamp}-${obs.metric}-${i}`}
              className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-white/[0.02]"
            >
              <span className="shrink-0 text-[10px] font-mono text-zinc-600 w-16">
                {new Date(obs.timestamp).toLocaleTimeString()}
              </span>
              <span
                className={cn(
                  "shrink-0 text-xs font-medium w-36 truncate",
                  metricColors[obs.metric] ?? "text-zinc-400",
                )}
              >
                {obs.metric}
              </span>
              <span className="text-xs font-mono text-zinc-200">
                {obs.value}
              </span>
              {obs.annotation && (
                <span className="text-[10px] text-zinc-500 truncate flex-1">
                  {obs.annotation}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
