import { MetricCard } from "@flink-reactor/ui"

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
