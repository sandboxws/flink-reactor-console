"use client"

import { useEffect } from "react"
import { ErrorExplorer } from "@/components/errors/error-explorer"
import { useErrorStore } from "@/stores/error-store"

// ---------------------------------------------------------------------------
// Errors page — polls job exceptions from the Go backend
// ---------------------------------------------------------------------------

export default function ErrorsPage() {
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
