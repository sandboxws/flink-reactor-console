"use client"

import { useState } from "react"
import { Bell } from "lucide-react"
import { AlertCard } from "../../components/monitoring/alert-card"
import { EmptyState } from "../../shared/empty-state"
import type { ActiveAlert } from "../../types"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface AlertsSectionProps {
  alerts: ActiveAlert[]
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AlertsSection({ alerts: initialAlerts }: AlertsSectionProps) {
  const [alerts, setAlerts] = useState(initialAlerts)

  function handleAcknowledge(id: string) {
    setAlerts((prev) =>
      prev.map((a) => (a.id === id ? { ...a, acknowledged: true } : a)),
    )
  }

  function handleResolve(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  if (alerts.length === 0) {
    return (
      <EmptyState icon={Bell} message="No active alerts." />
    )
  }

  const critical = alerts.filter((a) => a.severity === "critical")
  const warning = alerts.filter((a) => a.severity === "warning")
  const info = alerts.filter((a) => a.severity === "info")

  return (
    <section className="space-y-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-zinc-100">
          Active Alerts
        </h2>
        <span className="text-[10px] tabular-nums text-zinc-500">
          {alerts.length} alert{alerts.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {[...critical, ...warning, ...info].map((alert) => (
          <AlertCard
            key={alert.id}
            alert={alert}
            onAcknowledge={handleAcknowledge}
            onResolve={handleResolve}
          />
        ))}
      </div>
    </section>
  )
}
