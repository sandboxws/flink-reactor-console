import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { HealthDashboard } from "@/components/insights/health-dashboard"
import { useClusterStore } from "@/stores/cluster-store"
import { useInsightsStore } from "@/stores/insights-store"

/** Route: /insights/health — Health dashboard with cluster and job health indicators via insights polling. */
export const Route = createFileRoute("/insights/health")({
  component: ClusterHealth,
})

function ClusterHealth() {
  const initCluster = useClusterStore((s) => s.initialize)
  const startClusterPolling = useClusterStore((s) => s.startPolling)
  const stopClusterPolling = useClusterStore((s) => s.stopPolling)

  const initInsights = useInsightsStore((s) => s.initialize)
  const startInsightsPolling = useInsightsStore((s) => s.startPolling)
  const stopInsightsPolling = useInsightsStore((s) => s.stopPolling)

  useEffect(() => {
    initCluster()
    startClusterPolling()
    initInsights()
    startInsightsPolling()
    return () => {
      stopClusterPolling()
      stopInsightsPolling()
    }
  }, [
    initCluster,
    startClusterPolling,
    stopClusterPolling,
    initInsights,
    startInsightsPolling,
    stopInsightsPolling,
  ])

  return <HealthDashboard />
}
