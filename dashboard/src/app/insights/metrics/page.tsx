"use client"

import { useEffect } from "react"
import { MetricsExplorer } from "@/components/insights/metrics-explorer"
import { useClusterStore } from "@/stores/cluster-store"
import { useMetricsExplorerStore } from "@/stores/metrics-explorer-store"

export default function MetricsExplorerPage() {
  const initCluster = useClusterStore((s) => s.initialize)
  const startClusterPolling = useClusterStore((s) => s.startPolling)
  const stopClusterPolling = useClusterStore((s) => s.stopPolling)

  const startMetricsPolling = useMetricsExplorerStore((s) => s.startPolling)
  const stopMetricsPolling = useMetricsExplorerStore((s) => s.stopPolling)

  useEffect(() => {
    initCluster()
    startClusterPolling()
    startMetricsPolling()
    return () => {
      stopClusterPolling()
      stopMetricsPolling()
    }
  }, [
    initCluster,
    startClusterPolling,
    stopClusterPolling,
    startMetricsPolling,
    stopMetricsPolling,
  ])

  return <MetricsExplorer />
}
