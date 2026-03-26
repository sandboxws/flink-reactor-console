/** Cluster statistic card -- single KPI card for task managers, slots, or job counts. */
"use client"

import { MetricCard } from "../../shared/metric-card"

/** Thin wrapper around MetricCard for cluster-level KPI display. */
export function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: React.ReactNode
  accent?: string
}) {
  return <MetricCard icon={icon} label={label} value={value} accent={accent} />
}
