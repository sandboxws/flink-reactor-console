"use client"

import { format } from "date-fns"
import { ArrowLeft, ArrowUpDown, Database, Loader2 } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import { EmptyState } from "@/components/shared/empty-state"
import { Badge } from "@/components/ui/badge"
import type {
  Checkpoint,
  CheckpointConfig,
  CheckpointCounts,
  CheckpointDetail,
  CheckpointStatus,
} from "@/data/cluster-types"
import { cn } from "@/lib/cn"
import { fetchCheckpointDetail } from "@/lib/flink-api-client"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function formatInterval(ms: number): string {
  if (ms >= 60_000) return `${ms / 60_000}min`
  return `${ms / 1000}s`
}

const checkpointStatusStyles: Record<CheckpointStatus, string> = {
  COMPLETED: "bg-job-finished/15 text-job-finished",
  IN_PROGRESS: "bg-job-running/15 text-job-running",
  FAILED: "bg-job-failed/15 text-job-failed",
}

// ---------------------------------------------------------------------------
// Sort helper
// ---------------------------------------------------------------------------

type SortKey =
  | "id"
  | "status"
  | "triggerTimestamp"
  | "duration"
  | "size"
  | "processedData"
type SortDir = "asc" | "desc"

function compareCheckpoints(
  a: Checkpoint,
  b: Checkpoint,
  key: SortKey,
  dir: SortDir,
): number {
  let cmp = 0
  switch (key) {
    case "id":
      cmp = a.id - b.id
      break
    case "status":
      cmp = a.status.localeCompare(b.status)
      break
    case "triggerTimestamp":
      cmp = a.triggerTimestamp.getTime() - b.triggerTimestamp.getTime()
      break
    case "duration":
      cmp = a.duration - b.duration
      break
    case "size":
      cmp = a.size - b.size
      break
    case "processedData":
      cmp = a.processedData - b.processedData
      break
  }
  return dir === "asc" ? cmp : -cmp
}

// ---------------------------------------------------------------------------
// Sparkline tooltip
// ---------------------------------------------------------------------------

function SparkTooltip({
  active,
  payload,
  unit,
}: {
  active?: boolean
  payload?: Array<{ value: number }>
  unit: "bytes" | "ms"
}) {
  if (!active || !payload?.length) return null
  const val = payload[0].value

  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <span className="text-[10px] text-fg-secondary">
        {unit === "bytes" ? formatBytes(val) : formatDuration(val)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CheckpointDetailView — drill-down for a single checkpoint
// ---------------------------------------------------------------------------

function CheckpointDetailView({
  jobId,
  checkpointId,
  onBack,
}: {
  jobId: string
  checkpointId: number
  onBack: () => void
}) {
  const [detail, setDetail] = useState<CheckpointDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetchCheckpointDetail(jobId, checkpointId)
      .then((d) => {
        if (!cancelled) setDetail(d)
      })
      .catch(() => {
        if (!cancelled) setDetail(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [jobId, checkpointId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          onClick={onBack}
          className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
        >
          <ArrowLeft className="size-3" />
          Back to Checkpoints
        </button>
        <EmptyState
          icon={Database}
          message="Failed to load checkpoint detail"
        />
      </div>
    )
  }

  const tasks = Object.entries(detail.tasks)

  return (
    <div className="flex flex-col gap-4">
      {/* Back link */}
      <button
        type="button"
        onClick={onBack}
        className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" />
        Back to Checkpoints
      </button>

      {/* Summary */}
      <div className="glass-card p-4">
        <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Checkpoint #{detail.id} —{" "}
          {detail.isSavepoint ? "Savepoint" : "Checkpoint"}
        </h3>
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-5">
          <div>
            <span className="text-zinc-500">Status</span>
            <div>
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 border-0 text-[10px]",
                  checkpointStatusStyles[detail.status],
                )}
              >
                {detail.status}
              </Badge>
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Trigger Time</span>
            <p className="font-mono tabular-nums text-zinc-200">
              {format(detail.triggerTimestamp, "HH:mm:ss")}
            </p>
          </div>
          <div>
            <span className="text-zinc-500">Duration</span>
            <p className="font-medium tabular-nums text-zinc-200">
              {formatDuration(detail.endToEndDuration)}
            </p>
          </div>
          <div>
            <span className="text-zinc-500">State Size</span>
            <p className="font-medium tabular-nums text-zinc-200">
              {formatBytes(detail.stateSize)}
            </p>
          </div>
          <div>
            <span className="text-zinc-500">Subtasks</span>
            <p className="font-medium tabular-nums text-zinc-200">
              {detail.numAcknowledgedSubtasks} / {detail.numSubtasks}
            </p>
          </div>
        </div>
      </div>

      {/* Per-vertex breakdown */}
      {tasks.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-dash-border px-3 py-2">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Per-Vertex Breakdown
            </h3>
            <span className="ml-auto font-mono text-[10px] text-zinc-600">
              {tasks.length} vertices
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Vertex
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Status
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Duration
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  State Size
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Subtasks
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(([vid, t]) => (
                <tr
                  key={vid}
                  className="border-b border-dash-border/50 transition-colors hover:bg-dash-hover"
                >
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-zinc-300">
                    {vid.slice(0, 12)}…
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-0 text-[10px]",
                        t.status === "COMPLETED"
                          ? "bg-job-finished/15 text-job-finished"
                          : t.status === "FAILED"
                            ? "bg-job-failed/15 text-job-failed"
                            : "bg-job-running/15 text-job-running",
                      )}
                    >
                      {t.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                    {formatDuration(t.endToEndDuration)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                    {formatBytes(t.stateSize)}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
                    {t.numAcknowledgedSubtasks} / {t.numSubtasks}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// CheckpointsTab
// ---------------------------------------------------------------------------

export function CheckpointsTab({
  jobId,
  checkpoints,
  counts,
  config,
}: {
  jobId: string
  checkpoints: Checkpoint[]
  counts: CheckpointCounts | null
  config: CheckpointConfig | null
}) {
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortDir, setSortDir] = useState<SortDir>("desc")
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<number | null>(
    null,
  )

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  const handleRowClick = useCallback((checkpointId: number) => {
    setSelectedCheckpoint(checkpointId)
  }, [])

  const sorted = useMemo(
    () =>
      [...checkpoints].sort((a, b) =>
        compareCheckpoints(a, b, sortKey, sortDir),
      ),
    [checkpoints, sortKey, sortDir],
  )

  const completed = checkpoints.filter((c) => c.status === "COMPLETED")
  const latest = sorted[0] ?? null

  // Sparkline data (completed only, chronological)
  const sparkData = useMemo(
    () =>
      [...completed]
        .sort(
          (a, b) => a.triggerTimestamp.getTime() - b.triggerTimestamp.getTime(),
        )
        .map((c) => ({
          size: c.size,
          duration: c.duration,
        })),
    [completed],
  )

  // Drill-down view
  if (selectedCheckpoint !== null) {
    return (
      <CheckpointDetailView
        jobId={jobId}
        checkpointId={selectedCheckpoint}
        onBack={() => setSelectedCheckpoint(null)}
      />
    )
  }

  if (checkpoints.length === 0 && !config) {
    return <EmptyState icon={Database} message="No checkpoint data available" />
  }

  const columns: { key: SortKey; label: string }[] = [
    { key: "id", label: "ID" },
    { key: "status", label: "Status" },
    { key: "triggerTimestamp", label: "Trigger Time" },
    { key: "duration", label: "Duration" },
    { key: "size", label: "Size" },
    { key: "processedData", label: "Processed Data" },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Checkpoint config summary */}
      {config && (
        <div className="glass-card p-4">
          <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Checkpoint Configuration
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-5">
            <div>
              <span className="text-zinc-500">Mode</span>
              <p className="font-medium text-zinc-200">{config.mode}</p>
            </div>
            <div>
              <span className="text-zinc-500">Interval</span>
              <p className="font-medium text-zinc-200">
                {formatInterval(config.interval)}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Timeout</span>
              <p className="font-medium text-zinc-200">
                {formatInterval(config.timeout)}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Min Pause</span>
              <p className="font-medium text-zinc-200">
                {formatInterval(config.minPause)}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Max Concurrent</span>
              <p className="font-medium text-zinc-200">
                {config.maxConcurrent}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Latest checkpoint detail */}
      {latest && latest.status === "COMPLETED" && (
        <div className="glass-card p-4">
          <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Latest Checkpoint
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-5">
            <div>
              <span className="text-zinc-500">ID</span>
              <p className="font-medium tabular-nums text-zinc-200">
                #{latest.id}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Status</span>
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 border-0 text-[10px]",
                  checkpointStatusStyles[latest.status],
                )}
              >
                {latest.status}
              </Badge>
            </div>
            <div>
              <span className="text-zinc-500">Duration</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatDuration(latest.duration)}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Size</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatBytes(latest.size)}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Processed</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatBytes(latest.processedData)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Checkpoint history table */}
      {checkpoints.length > 0 && (
        <div className="glass-card overflow-hidden">
          {counts && counts.total > checkpoints.length && (
            <div className="flex items-center justify-between border-b border-dash-border px-3 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Checkpoint History
              </span>
              <span className="text-[10px] text-zinc-600">
                Showing last {checkpoints.length} of {counts.total} total
              </span>
            </div>
          )}
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    className="px-3 py-2 text-left font-medium text-zinc-500"
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(col.key)}
                      className="flex items-center gap-1 transition-colors hover:text-zinc-300"
                    >
                      {col.label}
                      <ArrowUpDown
                        className={cn(
                          "size-3",
                          sortKey === col.key
                            ? "text-zinc-300"
                            : "text-zinc-700",
                        )}
                      />
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((cp) => (
                <tr
                  key={cp.id}
                  className="cursor-pointer border-b border-dash-border/50 transition-colors hover:bg-dash-hover"
                  onClick={() => handleRowClick(cp.id)}
                >
                  <td className="px-3 py-2 tabular-nums text-zinc-300">
                    #{cp.id}
                    {cp.isSavepoint && (
                      <span className="ml-1.5 text-[9px] text-fr-amber">
                        SP
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="outline"
                      className={cn(
                        "border-0 text-[10px]",
                        checkpointStatusStyles[cp.status],
                      )}
                    >
                      {cp.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-400">
                    {format(cp.triggerTimestamp, "HH:mm:ss")}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-400">
                    {cp.duration > 0 ? formatDuration(cp.duration) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-400">
                    {cp.size > 0 ? formatBytes(cp.size) : "—"}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-zinc-400">
                    {cp.processedData > 0 ? formatBytes(cp.processedData) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Trend sparklines */}
      {sparkData.length >= 3 && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <div className="glass-card p-4">
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Size Trend
            </h3>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart
                data={sparkData}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient id="sparkSize" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor="var(--color-fr-coral)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-fr-coral)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="size" hide />
                <Tooltip
                  content={<SparkTooltip unit="bytes" />}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="size"
                  stroke="var(--color-fr-coral)"
                  fill="url(#sparkSize)"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="glass-card p-4">
            <h3 className="mb-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Duration Trend
            </h3>
            <ResponsiveContainer width="100%" height={80}>
              <AreaChart
                data={sparkData}
                margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
              >
                <defs>
                  <linearGradient
                    id="sparkDuration"
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="1"
                  >
                    <stop
                      offset="5%"
                      stopColor="var(--color-fr-purple)"
                      stopOpacity={0.3}
                    />
                    <stop
                      offset="95%"
                      stopColor="var(--color-fr-purple)"
                      stopOpacity={0.02}
                    />
                  </linearGradient>
                </defs>
                <XAxis dataKey="duration" hide />
                <Tooltip
                  content={<SparkTooltip unit="ms" />}
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  dataKey="duration"
                  stroke="var(--color-fr-purple)"
                  fill="url(#sparkDuration)"
                  strokeWidth={1.5}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
