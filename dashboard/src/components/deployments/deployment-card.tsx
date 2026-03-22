import { Link } from "@tanstack/react-router"
import { cn } from "@/lib/cn"

interface DeploymentCardProps {
  label: "Blue" | "Green"
  deploymentName: string | null
  jobId: string | null
  jobStatus: string | null
  isActive: boolean
}

export function DeploymentCard({
  label,
  deploymentName,
  jobId,
  jobStatus,
  isActive,
}: DeploymentCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        isActive
          ? "border-status-active/50 bg-status-active/5"
          : "border-dash-border bg-dash-surface",
      )}
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">{label}</h3>
        {isActive && (
          <span className="text-[10px] font-medium uppercase tracking-wider text-status-active">
            Active
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-zinc-500">Deployment</span>
          <span className="font-mono text-zinc-300">
            {deploymentName ?? "-"}
          </span>
        </div>

        <div className="flex justify-between">
          <span className="text-zinc-500">Job ID</span>
          {jobId ? (
            <Link
              to={`/jobs/${jobId}`}
              className="font-mono text-sky-400 hover:text-sky-300 transition-colors"
            >
              {jobId.slice(0, 16)}...
            </Link>
          ) : (
            <span className="text-zinc-600">-</span>
          )}
        </div>

        {jobStatus && (
          <div className="flex justify-between">
            <span className="text-zinc-500">Status</span>
            <span className="text-zinc-300">{jobStatus}</span>
          </div>
        )}
      </div>
    </div>
  )
}
