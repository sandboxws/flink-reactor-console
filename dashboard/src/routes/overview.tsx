import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { OverviewPage } from "@/components/overview/overview-page"
import { useClusterStore } from "@/stores/cluster-store"

export const Route = createFileRoute("/overview")({
  component: Overview,
})

function Overview() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  return <OverviewPage />
}
