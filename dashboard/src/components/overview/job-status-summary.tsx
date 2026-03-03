import { AlertTriangle, Ban, CheckCircle2, Play } from "lucide-react"

const statuses = [
  {
    key: "running",
    label: "Running",
    color: "text-job-running",
    bg: "bg-job-running/10",
    icon: Play,
  },
  {
    key: "finished",
    label: "Finished",
    color: "text-job-finished",
    bg: "bg-job-finished/10",
    icon: CheckCircle2,
  },
  {
    key: "cancelled",
    label: "Cancelled",
    color: "text-job-cancelled",
    bg: "bg-job-cancelled/10",
    icon: Ban,
  },
  {
    key: "failed",
    label: "Failed",
    color: "text-job-failed",
    bg: "bg-job-failed/10",
    icon: AlertTriangle,
  },
] as const

export function JobStatusSummary({
  running,
  finished,
  cancelled,
  failed,
}: {
  running: number
  finished: number
  cancelled: number
  failed: number
}) {
  const counts: Record<string, number> = {
    running,
    finished,
    cancelled,
    failed,
  }

  return (
    <div className="glass-card p-4">
      <span className="text-xs font-medium uppercase tracking-wide text-zinc-500">
        Job Status
      </span>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {statuses.map((s) => (
          <div
            key={s.key}
            className={`flex flex-col items-center gap-1 rounded-lg ${s.bg} px-3 py-2`}
          >
            <s.icon className={`size-4 ${s.color}`} />
            <span className={`text-lg font-semibold ${s.color}`}>
              {counts[s.key]}
            </span>
            <span className="text-[0.625rem] text-zinc-500">{s.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
