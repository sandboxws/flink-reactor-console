"use client"

import { useEffect } from "react"
import { CheckpointAnalytics } from "@/components/monitoring/checkpoint-analytics"
import { useCheckpointAnalyticsStore } from "@/stores/checkpoint-analytics-store"
import { useClusterStore } from "@/stores/cluster-store"

export default function CheckpointsPage() {
  const initCluster = useClusterStore((s) => s.initialize)
  const startClusterPolling = useClusterStore((s) => s.startPolling)
  const stopClusterPolling = useClusterStore((s) => s.stopPolling)
  const initCheckpoints = useCheckpointAnalyticsStore((s) => s.initialize)
  const startCheckpointPolling = useCheckpointAnalyticsStore(
    (s) => s.startPolling,
  )
  const stopCheckpointPolling = useCheckpointAnalyticsStore(
    (s) => s.stopPolling,
  )

  useEffect(() => {
    initCluster()
    startClusterPolling()
    initCheckpoints()
    startCheckpointPolling()
    return () => {
      stopClusterPolling()
      stopCheckpointPolling()
    }
  }, [
    initCluster,
    startClusterPolling,
    stopClusterPolling,
    initCheckpoints,
    startCheckpointPolling,
    stopCheckpointPolling,
  ])

  return <CheckpointAnalytics />
}
