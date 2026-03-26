/**
 * @module jm-logs-tab
 *
 * Job Manager log viewer tab. Parses the raw log text into structured
 * {@link LogEntry} records and renders them via {@link StaticLogExplorer}
 * with full-height scrolling.
 */

import { useMemo } from "react"
import { StaticLogExplorer } from "@flink-reactor/ui"
import { parseLogBlock } from "@/data/log-parser"
import type { LogSource } from "@flink-reactor/ui"

/** Static log source descriptor for Job Manager log entries. */
const JM_SOURCE: LogSource = {
  type: "jobmanager",
  id: "jm",
  label: "JobManager",
}

/**
 * Renders Job Manager log output in the unified {@link StaticLogExplorer}.
 * The raw log string is parsed once via {@link parseLogBlock} and memoised.
 */
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
