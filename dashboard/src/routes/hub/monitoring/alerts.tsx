import { createFileRoute } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubMonitoringAlerts() {
  return (
    <HubComingSoon
      crumbs={[{ label: "Monitoring" }, { label: "Alerts" }]}
      phase="P3"
      description="Linear-style alerts UI on top of the existing client-side alerts engine (useAlertsStore). Active alerts grouped by severity, rule editor, history. Server-side alerts engine ships as a separate change (fr-server-XX-alerts-engine)."
    />
  )
}

export const Route = createFileRoute("/hub/monitoring/alerts")({
  component: HubMonitoringAlerts,
})
