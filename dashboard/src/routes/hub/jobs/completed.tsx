/**
 * Hub completed pipelines — /hub/jobs/completed.
 *
 * Mirrors `console-v2/jobs-completed.html`: status filter chips + time-range
 * selector + sortable table. Reads from `useClusterStore.completedJobs`.
 */

import { HubBreadcrumb, PropChip } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Calendar, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { CompletedJobsTable } from "@/components/hub/jobs/completed-jobs-table"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"

type Range = "24h" | "7d" | "30d" | "all"
type StatusFilter = "all" | "FINISHED" | "FAILED" | "CANCELED"

const RANGE_LABEL: Record<Range, string> = {
  "24h": "Last 24h",
  "7d": "Last 7d",
  "30d": "Last 30d",
  all: "All time",
}

const RANGE_MS: Record<Range, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
  all: Number.POSITIVE_INFINITY,
}

function HubJobsCompleted() {
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const refresh = useClusterStore((s) => s.refresh)
  const completedJobs = useClusterStore((s) => s.completedJobs)
  const fetchError = useClusterStore((s) => s.fetchError)

  const [range, setRange] = useState<Range>("24h")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [search, setSearch] = useState("")

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  const visibleJobs = useMemo(() => {
    const cutoff = Date.now() - RANGE_MS[range]
    const lower = search.toLowerCase()
    return completedJobs.filter((j) => {
      if (status !== "all" && j.status !== status) return false
      const ts = j.endTime?.getTime() ?? j.startTime.getTime()
      if (ts < cutoff) return false
      if (lower) {
        const hit =
          j.name.toLowerCase().includes(lower) ||
          j.id.toLowerCase().includes(lower)
        if (!hit) return false
      }
      return true
    })
  }, [completedJobs, range, status, search])

  const counts = useMemo(() => {
    let finished = 0
    let failed = 0
    let canceled = 0
    for (const j of completedJobs) {
      if (j.status === "FINISHED") finished++
      else if (j.status === "FAILED") failed++
      else if (j.status === "CANCELED") canceled++
    }
    return { finished, failed, canceled }
  }, [completedJobs])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Pipelines", to: "/hub/jobs/running" },
          { label: "Completed" },
        ]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Completed pipelines
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {counts.finished} finished · {counts.failed} failed ·{" "}
            {counts.canceled} canceled
          </p>
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={() => refresh()}
        >
          <RefreshCw />
          Refresh
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-dash-border pb-3">
        <input
          type="text"
          placeholder="Filter by name or ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="form-input mono"
          style={{ height: 30, fontSize: 12, maxWidth: 280 }}
        />
        <PropChip
          active={status === "FINISHED"}
          onClick={() => setStatus(status === "FINISHED" ? "all" : "FINISHED")}
        >
          Finished
        </PropChip>
        <PropChip
          active={status === "FAILED"}
          onClick={() => setStatus(status === "FAILED" ? "all" : "FAILED")}
        >
          Failed
        </PropChip>
        <PropChip
          active={status === "CANCELED"}
          onClick={() => setStatus(status === "CANCELED" ? "all" : "CANCELED")}
        >
          Canceled
        </PropChip>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => {
              const order: Range[] = ["24h", "7d", "30d", "all"]
              const idx = order.indexOf(range)
              setRange(order[(idx + 1) % order.length])
            }}
          >
            <Calendar />
            {RANGE_LABEL[range]}
          </button>
        </div>
      </div>

      {fetchError ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fr-rose">
          {fetchError}
        </div>
      ) : (
        <CompletedJobsTable jobs={visibleJobs} />
      )}
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/jobs/completed")({
  component: HubJobsCompleted,
})
