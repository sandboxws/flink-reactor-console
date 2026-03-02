"use client"

import { useEffect } from "react"
import { BottleneckAnalyzerPage } from "@/components/insights/bottleneck-analyzer"
import { useClusterStore } from "@/stores/cluster-store"
import { useInsightsStore } from "@/stores/insights-store"

export default function BottlenecksPage() {
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

  return <BottleneckAnalyzerPage />
}
