"use client"

import { createErrorGroup } from "../../fixtures"
import { ErrorExplorerSection } from "./error-explorer-section"

const errors = [
  createErrorGroup(),
  createErrorGroup({
    id: "err-2",
    exceptionClass: "java.io.IOException",
    message: "Connection reset by peer",
    count: 7,
    affectedSources: [
      { type: "taskmanager", id: "tm-1", label: "TM-1" },
      { type: "taskmanager", id: "tm-2", label: "TM-2" },
    ],
  }),
  createErrorGroup({
    id: "err-3",
    exceptionClass: "org.apache.flink.util.FlinkRuntimeException",
    message: "Could not materialize checkpoint 143",
    count: 1,
  }),
]

/** Standalone demo of the error explorer section with fixture error groups. */
export function ErrorExplorerSectionDemo() {
  return (
    <div className="max-w-3xl rounded-lg border border-dash-border bg-dash-surface">
      <ErrorExplorerSection
        errors={errors}
        onViewLogs={(id) => console.log("view logs for", id)}
      />
    </div>
  )
}
