import { useMemo } from "react"
import { StaticLogExplorer } from "@/components/shared/static-log-explorer"
import { parseLogBlock } from "@/data/log-parser"
import type { LogSource } from "@/data/types"

// ---------------------------------------------------------------------------
// TmLogsTab — renders TM logs using the unified log explorer
// ---------------------------------------------------------------------------

const TM_SOURCE: LogSource = {
  type: "taskmanager",
  id: "tm",
  label: "TaskManager",
}

export function TmLogsTab({ logs }: { logs: string }) {
  const entries = useMemo(() => {
    const { entries } = parseLogBlock(logs, TM_SOURCE)
    return entries
  }, [logs])

  return (
    <div className="pt-4">
      <StaticLogExplorer entries={entries} className="h-[calc(100vh-12rem)]" />
    </div>
  )
}
