import { cn } from "@flink-reactor/ui"
import { formatDistanceToNow } from "date-fns"

export function InstrumentHealthBadge({
  healthy,
  lastHealthCheck,
}: {
  healthy: boolean
  lastHealthCheck?: Date | null
}) {
  const label = healthy ? "Healthy" : "Unhealthy"
  const tooltip = lastHealthCheck
    ? `Last checked ${formatDistanceToNow(lastHealthCheck, { addSuffix: true })}`
    : undefined

  return (
    <span className="inline-flex items-center gap-1.5" title={tooltip}>
      <span
        className={cn(
          "size-2 rounded-full",
          healthy ? "bg-green-500" : "bg-red-500",
        )}
      />
      <span
        className={cn("text-xs", healthy ? "text-green-400" : "text-red-400")}
      >
        {label}
      </span>
    </span>
  )
}
