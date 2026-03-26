import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { LogExplorer } from "@/components/logs/log-explorer"
import { useLogStore } from "@/stores/log-store"

/** Route: /logs — Log explorer with real-time streaming, filtering, and search. */
export const Route = createFileRoute("/logs")({
  component: Logs,
})

function Logs() {
  const startStreaming = useLogStore((s) => s.startStreaming)
  const stopStreaming = useLogStore((s) => s.stopStreaming)

  useEffect(() => {
    startStreaming()
    return () => stopStreaming()
  }, [startStreaming, stopStreaming])

  return <LogExplorer />
}
