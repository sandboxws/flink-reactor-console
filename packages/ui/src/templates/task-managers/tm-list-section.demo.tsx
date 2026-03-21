"use client"

import { createTaskManager, createTaskManagerMetrics } from "../../fixtures"
import { TmListSection } from "./tm-list-section"

const taskManagers = [
  createTaskManager({ id: "tm-0-abc123" }),
  createTaskManager({
    id: "tm-1-def456",
    slotsFree: 0,
    metrics: createTaskManagerMetrics({ cpuUsage: 0.72 }),
  }),
  createTaskManager({
    id: "tm-2-ghi789",
    slotsFree: 3,
    metrics: createTaskManagerMetrics({
      cpuUsage: 0.92,
      heapUsed: 3_800_000_000,
    }),
  }),
]

export function TmListSectionDemo() {
  return (
    <div className="max-w-5xl rounded-lg border border-dash-border bg-dash-surface">
      <TmListSection
        taskManagers={taskManagers}
        onSelect={(id) => console.log("selected TM", id)}
      />
    </div>
  )
}
