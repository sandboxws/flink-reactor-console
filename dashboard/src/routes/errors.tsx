import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { ErrorExplorer } from "@/components/errors/error-explorer"
import { useErrorStore } from "@/stores/error-store"

/** Route: /errors — Error explorer with live exception polling, grouping, and stack traces. */
export const Route = createFileRoute("/errors")({
  component: Errors,
})

function Errors() {
  const startLiveExceptionPolling = useErrorStore(
    (s) => s.startLiveExceptionPolling,
  )
  const stopLiveExceptionPolling = useErrorStore(
    (s) => s.stopLiveExceptionPolling,
  )

  useEffect(() => {
    startLiveExceptionPolling()
    return () => stopLiveExceptionPolling()
  }, [startLiveExceptionPolling, stopLiveExceptionPolling])

  return <ErrorExplorer />
}
