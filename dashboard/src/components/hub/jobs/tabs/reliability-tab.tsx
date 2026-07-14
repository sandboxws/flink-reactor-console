/**
 * Hub job-detail Reliability tab.
 *
 * Observe-only failover view: restart counts + active restart strategy +
 * uptime/downtime (from job-level metrics), plus a failover timeline projected
 * from the job's existing exception history. Absent metrics render "—"
 * (unknown), never "0".
 */

import type { FlinkJob } from "@flink-reactor/ui"
import { Clock, RotateCcw, ShieldAlert } from "lucide-react"
import { cn } from "@/lib/cn"

/** Format a Long-safe ms string as a human duration; null/invalid → "—". */
function formatMs(ms: string | null): string {
  if (ms === null) return "—"
  const n = Number(ms)
  if (!Number.isFinite(n)) return "—"
  if (n < 1_000) return `${n}ms`
  if (n < 60_000) return `${(n / 1_000).toFixed(1)}s`
  if (n < 3_600_000) return `${(n / 60_000).toFixed(1)}m`
  return `${(n / 3_600_000).toFixed(1)}h`
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div
        className={cn(
          "font-mono text-[14px]",
          warn ? "text-fr-amber" : "text-fg",
        )}
      >
        {value}
      </div>
    </div>
  )
}

export function HubReliabilityTab({ job }: { job: FlinkJob }) {
  const ri = job.restartInfo
  const exceptions = job.exceptions ?? []
  const numRestarts = ri?.numRestarts ?? null
  const events = [...exceptions].sort(
    (a, b) => b.timestamp.getTime() - a.timestamp.getTime(),
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat
          label="Restarts"
          value={numRestarts === null ? "—" : String(numRestarts)}
          warn={numRestarts !== null && numRestarts > 0}
        />
        <Stat
          label="Full restarts"
          value={ri?.fullRestarts == null ? "—" : String(ri.fullRestarts)}
          warn={ri?.fullRestarts != null && ri.fullRestarts > 0}
        />
        <Stat label="Uptime" value={formatMs(ri?.uptimeMs ?? null)} />
        <Stat label="Downtime" value={formatMs(ri?.downtimeMs ?? null)} />
      </div>

      <div className="glass-card-static flex flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 text-fg-muted" />
          <span className="font-sans text-[13px] font-medium text-zinc-100">
            Restart strategy
          </span>
        </div>
        <p className="font-mono text-[12px] text-fg-muted break-all">
          {ri?.restartStrategy ?? "—"}
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2 text-[12px] text-fg-muted">
          <RotateCcw className="size-3.5" />
          <span>Failover timeline</span>
          <span className="text-fg-faint">· from exception history</span>
        </div>

        {events.length === 0 ? (
          <div className="glass-card-static flex flex-col items-center justify-center gap-2 py-12">
            <Clock className="size-6 text-fg-faint" />
            <p className="text-[13px] text-fg-muted">
              No failover events recorded
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((e) => (
              <li
                key={`${e.timestamp.getTime()}-${e.name}-${e.taskName ?? ""}`}
                className="glass-card-static flex flex-col gap-1 p-3"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[12px] text-fr-rose">
                    {e.name || "Exception"}
                  </span>
                  <span className="whitespace-nowrap font-mono text-[11px] text-fg-faint">
                    {e.timestamp.toLocaleString()}
                  </span>
                </div>
                {e.message ? (
                  <p className="line-clamp-2 font-mono text-[11px] text-fg-muted">
                    {e.message}
                  </p>
                ) : null}
                {e.taskName ? (
                  <p className="truncate font-mono text-[10px] text-fg-faint">
                    {e.taskName}
                  </p>
                ) : null}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>
  )
}
