"use client"

import { useEffect, useRef } from "react"
import { ErrorExplorer } from "@/components/errors/error-explorer"
import { useConfigStore } from "@/stores/config-store"
import { useErrorStore } from "@/stores/error-store"
import { useLogStore } from "@/stores/log-store"

// ---------------------------------------------------------------------------
// Errors page — subscribes to log store (mock) or polls exceptions (live)
// ---------------------------------------------------------------------------

export default function ErrorsPage() {
  const processEntry = useErrorStore((s) => s.processEntry)
  const startLiveExceptionPolling = useErrorStore(
    (s) => s.startLiveExceptionPolling,
  )
  const stopLiveExceptionPolling = useErrorStore(
    (s) => s.stopLiveExceptionPolling,
  )
  const startStreaming = useLogStore((s) => s.startStreaming)
  const stopStreaming = useLogStore((s) => s.stopStreaming)
  const mockMode = useConfigStore((s) => s.config?.mockMode ?? true)
  const processedCountRef = useRef(0)

  // In mock mode: start log streaming to generate entries
  // In live mode: start polling job exceptions directly
  useEffect(() => {
    if (mockMode) {
      startStreaming()
      return () => stopStreaming()
    }
    startLiveExceptionPolling()
    return () => stopLiveExceptionPolling()
  }, [
    mockMode,
    startStreaming,
    stopStreaming,
    startLiveExceptionPolling,
    stopLiveExceptionPolling,
  ])

  // In mock mode: subscribe to log store entries and process new exceptions
  useEffect(() => {
    if (!mockMode) return

    const unsub = useLogStore.subscribe((state) => {
      const entries = state.entries
      const start = processedCountRef.current
      if (start >= entries.length) return

      for (let i = start; i < entries.length; i++) {
        if (entries[i].isException) {
          processEntry(entries[i])
        }
      }
      processedCountRef.current = entries.length
    })

    // Process any entries already in the store
    const existing = useLogStore.getState().entries
    for (let i = processedCountRef.current; i < existing.length; i++) {
      if (existing[i].isException) {
        processEntry(existing[i])
      }
    }
    processedCountRef.current = existing.length

    return unsub
  }, [mockMode, processEntry])

  return <ErrorExplorer />
}
