"use client"

import { useMemo } from "react"
import { StaticLogExplorer } from "@/components/shared/static-log-explorer"
import { parseLogBlock } from "@/data/log-parser"
import type { LogSource } from "@/data/types"

// ---------------------------------------------------------------------------
// JmLogsTab — renders JM logs using the unified log explorer
// ---------------------------------------------------------------------------

const JM_SOURCE: LogSource = {
  type: "jobmanager",
  id: "jm",
  label: "JobManager",
}

export function JmLogsTab({ logs }: { logs: string }) {
  const entries = useMemo(() => {
    const { entries } = parseLogBlock(logs, JM_SOURCE)
    return entries
  }, [logs])

  return (
    <div className="pt-4">
      <StaticLogExplorer entries={entries} className="h-[calc(100vh-12rem)]" />
    </div>
  )
}
