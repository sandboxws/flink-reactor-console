/**
 * @module tm-logs-tab
 *
 * Task manager log viewer tab that parses raw log text into structured
 * entries and renders them via the shared {@link StaticLogExplorer}.
 */
import { useMemo } from "react"
import { StaticLogExplorer } from "@flink-reactor/ui"
import { parseLogBlock } from "@/data/log-parser"
import type { LogSource } from "@flink-reactor/ui"

// ---------------------------------------------------------------------------
// TmLogsTab — renders TM logs using the unified log explorer
// ---------------------------------------------------------------------------

/** Default log source descriptor for task manager logs. */
const TM_SOURCE: LogSource = {
  type: "taskmanager",
  id: "tm",
  label: "TaskManager",
}

/**
 * Renders pre-fetched task manager log output through the unified
 * {@link StaticLogExplorer} with full search, filtering, and severity
 * highlighting. Log text is parsed into structured entries on mount.
 */
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
