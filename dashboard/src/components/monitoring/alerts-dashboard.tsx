import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Info,
  Plus,
  Shield,
} from "lucide-react"
import { useState } from "react"
import { MetricCard, Skeleton } from "@flink-reactor/ui"
import { cn } from "@/lib/cn"
import { useAlertsStore } from "@/stores/alerts-store"
import { AlertCard } from "./alert-card"
import { CreateRuleDialog } from "./create-rule-dialog"
import { RuleList } from "./rule-list"

// Loading skeleton

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <Skeleton className="h-6 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="glass-card p-4">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-2 h-8 w-16" />
          </div>
        ))}
      </div>
      <Skeleton className="h-48 w-full rounded-lg" />
      <Skeleton className="h-64 w-full rounded-lg" />
    </div>
  )
}

// Severity icon helper

const SEVERITY_ICON = {
  critical: { icon: AlertCircle, color: "text-job-failed" },
  warning: { icon: AlertTriangle, color: "text-fr-amber" },
  info: { icon: Info, color: "text-fr-purple" },
} as const

// Main component

export function AlertsDashboard() {
  const rules = useAlertsStore((s) => s.rules)
  const activeAlerts = useAlertsStore((s) => s.activeAlerts)
  const acknowledgeAlert = useAlertsStore((s) => s.acknowledgeAlert)
  const resolveAlert = useAlertsStore((s) => s.resolveAlert)
  const toggleRule = useAlertsStore((s) => s.toggleRule)
  const deleteRule = useAlertsStore((s) => s.deleteRule)
  const createRule = useAlertsStore((s) => s.createRule)

  const [dialogOpen, setDialogOpen] = useState(false)

  // If store hasn't loaded yet (no rules at all, even presets)
  if (rules.length === 0) return <LoadingSkeleton />

  const criticalCount = activeAlerts.filter(
    (a) => a.severity === "critical",
  ).length
  const warningCount = activeAlerts.filter(
    (a) => a.severity === "warning",
  ).length
  const infoCount = activeAlerts.filter((a) => a.severity === "info").length

  // Determine highest severity for the badge
  const highestSeverity =
    criticalCount > 0
      ? "critical"
      : warningCount > 0
        ? "warning"
        : infoCount > 0
          ? "info"
          : null

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <h1 className="text-lg font-semibold text-zinc-100">Alerts & Rules</h1>
        {highestSeverity && (
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
              highestSeverity === "critical" &&
                "bg-job-failed/10 text-job-failed",
              highestSeverity === "warning" && "bg-fr-amber/10 text-fr-amber",
              highestSeverity === "info" && "bg-fr-purple/10 text-fr-purple",
            )}
          >
            {(() => {
              const cfg = SEVERITY_ICON[highestSeverity]
              const Icon = cfg.icon
              return <Icon className={cn("size-3", cfg.color)} />
            })()}
            {activeAlerts.length} active
          </span>
        )}
      </div>

      {/* Summary metric cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={AlertCircle}
          label="Critical Alerts"
          value={criticalCount}
          accent="text-job-failed"
        />
        <MetricCard
          icon={AlertTriangle}
          label="Warning Alerts"
          value={warningCount}
          accent="text-fr-amber"
        />
        <MetricCard
          icon={Shield}
          label="Active Rules"
          value={rules.filter((r) => r.enabled).length}
          accent="text-fr-purple"
        />
      </div>

      {/* Active Alerts section */}
      <div>
        <h2 className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Active Alerts
        </h2>
        {activeAlerts.length === 0 ? (
          <div className="glass-card flex flex-col items-center justify-center gap-2 py-10">
            <CheckCircle2 className="size-8 text-job-running" />
            <p className="text-sm text-zinc-400">No active alerts</p>
            <p className="text-xs text-zinc-600">
              All metrics are within configured thresholds
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeAlerts
              .sort((a, b) => {
                const order = { critical: 0, warning: 1, info: 2 }
                return order[a.severity] - order[b.severity]
              })
              .map((alert) => (
                <AlertCard
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={acknowledgeAlert}
                  onResolve={resolveAlert}
                />
              ))}
          </div>
        )}
      </div>

      {/* Rules section */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
            Rules
          </h2>
          <button
            type="button"
            onClick={() => setDialogOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-dash-border px-2.5 py-1.5 text-xs text-zinc-400 transition-colors hover:bg-white/[0.04] hover:text-zinc-300"
          >
            <Plus className="size-3" />
            Create Rule
          </button>
        </div>
        <RuleList rules={rules} onToggle={toggleRule} onDelete={deleteRule} />
      </div>

      {/* Create rule dialog */}
      <CreateRuleDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onCreate={createRule}
      />
    </div>
  )
}
