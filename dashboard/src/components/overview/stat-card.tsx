/**
 * @module stat-card
 *
 * Thin wrapper around the shared {@link MetricCard} primitive, used on the
 * overview page for cluster-level statistics (task managers, slots, etc.).
 */

import { MetricCard } from "@flink-reactor/ui"

/** Delegates to {@link MetricCard} with overview-specific defaults. */
export function StatCard({
  icon,
  label,
  value,
  accent,
}: {
  /** Lucide icon component displayed beside the metric label. */
  icon: React.ComponentType<{ className?: string }>
  /** Human-readable metric name. */
  label: string
  /** Metric value to display prominently. */
  value: React.ReactNode
  /** Optional Tailwind text-color class for the icon accent. */
  accent?: string
}) {
  return <MetricCard icon={icon} label={label} value={value} accent={accent} />
}
