"use client"

import { createLogEntries } from "../../fixtures"
import { LogExplorerSection } from "./log-explorer-section"

const logs = createLogEntries(200)

/** Standalone demo of the log explorer section with fixture log entries. */
export function LogExplorerSectionDemo() {
  return (
    <div className="h-[600px] overflow-hidden rounded-lg border border-dash-border bg-dash-surface">
      <LogExplorerSection
        logs={logs}
        timestampFormat="time"
        onFilterChange={(f) => console.log("filter changed", f)}
      />
    </div>
  )
}
