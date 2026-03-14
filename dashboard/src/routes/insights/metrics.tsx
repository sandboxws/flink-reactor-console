import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { MetricsExplorer } from "@/components/insights/metrics-explorer"
import { useMetricsExplorerStore } from "@/stores/metrics-explorer-store"

export const Route = createFileRoute("/insights/metrics")({
  component: Metrics,
})

function Metrics() {
  const startPolling = useMetricsExplorerStore((s) => s.startPolling)
  const stopPolling = useMetricsExplorerStore((s) => s.stopPolling)
  const fetchCatalog = useMetricsExplorerStore((s) => s.fetchCatalog)

  useEffect(() => {
    fetchCatalog()
    startPolling()
    return () => {
      stopPolling()
    }
  }, [fetchCatalog, startPolling, stopPolling])

  return <MetricsExplorer />
}
