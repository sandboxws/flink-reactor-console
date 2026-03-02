"use client"

import { useEffect } from "react"
import { LogExplorer } from "@/components/logs/log-explorer"
import { useLogStore } from "@/stores/log-store"

export default function LogsPage() {
  const startStreaming = useLogStore((s) => s.startStreaming)
  const stopStreaming = useLogStore((s) => s.stopStreaming)

  // Start mock data streaming on mount, stop on unmount
  useEffect(() => {
    startStreaming()
    return () => stopStreaming()
  }, [startStreaming, stopStreaming])

  return <LogExplorer />
}
