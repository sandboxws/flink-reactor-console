/**
 * @module alert-card
 * Displays a single active alert with severity indicator, threshold details,
 * relative timestamp, and acknowledge/resolve action buttons.
 */
import { formatDistanceToNow } from "date-fns"
import { AlertCircle, AlertTriangle, Check, Info, X } from "lucide-react"
import { cn } from "@/lib/cn"
import type { ActiveAlert } from "@/stores/alerts-store"

/** Props for {@link AlertCard}. */
type AlertCardProps = {
  /** The active alert to render. */
  alert: ActiveAlert
  /** Called when the user acknowledges the alert. */
  onAcknowledge: (id: string) => void
  /** Called when the user resolves (dismisses) the alert. */
  onResolve: (id: string) => void
}

/** Per-severity visual configuration: icon, icon color, background, and border. */
const SEVERITY_CONFIG = {
  critical: {
    icon: AlertCircle,
    iconColor: "text-job-failed",
    bgColor: "bg-job-failed/10",
    borderColor: "border-job-failed/20",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-fr-amber",
    bgColor: "bg-fr-amber/10",
    borderColor: "border-fr-amber/20",
  },
  info: {
    icon: Info,
    iconColor: "text-fr-purple",
    bgColor: "bg-fr-purple/10",
    borderColor: "border-fr-purple/20",
  },
} as const

/**
 * Renders an active alert as a severity-colored card showing the rule name,
 * current vs threshold values, and relative trigger time. Acknowledged alerts
 * are visually dimmed. Supports acknowledge and resolve actions.
 */
export function AlertCard({ alert, onAcknowledge, onResolve }: AlertCardProps) {
  const config = SEVERITY_CONFIG[alert.severity]
  const Icon = config.icon

  return (
    <div
      className={cn(
        "glass-card flex items-start gap-3 border p-3",
        config.borderColor,
        alert.acknowledged && "opacity-60",
      )}
    >
      {/* Severity icon */}
      <div
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-md",
          config.bgColor,
        )}
      >
        <Icon className={cn("size-4", config.iconColor)} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-zinc-100">{alert.ruleName}</p>
        <p className="mt-0.5 text-xs text-zinc-400">{alert.message}</p>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-zinc-600">
          <span>
            Current:{" "}
            {Number.isInteger(alert.currentValue)
              ? alert.currentValue
              : alert.currentValue.toFixed(1)}
          </span>
          <span>|</span>
          <span>Threshold: {alert.threshold}</span>
          <span>|</span>
          <span>
            {formatDistanceToNow(alert.triggeredAt, { addSuffix: true })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1">
        {!alert.acknowledged && (
          <button
            type="button"
            onClick={() => onAcknowledge(alert.id)}
            className="rounded-md border border-dash-border px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
            title="Acknowledge"
          >
            <Check className="size-3" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onResolve(alert.id)}
          className="rounded-md border border-dash-border px-2 py-1 text-[10px] text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          title="Resolve"
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
