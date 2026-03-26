/**
 * @module checkpoints-tab
 *
 * Checkpoint history and statistics tab for the job detail view. Displays checkpoint
 * counts, configuration summary, latest completed/failed/savepoint entries, a sortable
 * history table with drill-down to per-operator and per-subtask detail, and size/duration
 * trend sparklines. Lazy-loads checkpoint and subtask detail via GraphQL on demand.
 */

import { Badge, EmptyState, formatBytes, formatDuration, Spinner } from "@flink-reactor/ui"
import { format } from "date-fns"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  Database,
  RotateCcw,
  Save,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts"
import type {
  Checkpoint,
  CheckpointConfig,
  CheckpointCounts,
  CheckpointDetail,
  CheckpointLatest,
  CheckpointStatus,
  CheckpointSubtaskStats,
} from "@flink-reactor/ui"
import { cn } from "@/lib/cn"
import {
  fetchCheckpointDetail,
  fetchCheckpointSubtaskDetail,
} from "@/lib/graphql-api-client"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a millisecond interval as a human-readable string (e.g. "5s", "2min"). */
function formatInterval(ms: number): string {
  if (ms >= 60_000) return `${ms / 60_000}min`
  return `${ms / 1000}s`
}

/** Tailwind classes mapping checkpoint status to badge colors. */
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
  | "checkpointedSize"
  | "processedData"
type SortDir = "asc" | "desc"

/** Compares two checkpoints by the given sort key and direction for table sorting. */
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
    case "checkpointedSize":
      cmp = (a.checkpointedSize ?? 0) - (b.checkpointedSize ?? 0)
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

/** Tooltip for checkpoint trend sparklines showing formatted bytes or duration. */
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
// ExpandableOperatorRow — per-operator row with lazy subtask loading
// ---------------------------------------------------------------------------

/**
 * Expandable table row for a single operator within a checkpoint detail view.
 * Lazy-loads per-subtask stats on first expand via {@link fetchCheckpointSubtaskDetail},
 * then shows min/avg/max summary and individual subtask rows.
 */
function ExpandableOperatorRow({
  vid,
  task,
  operatorName,
  jobId,
  checkpointId,
}: {
  vid: string
  task: CheckpointDetail["tasks"][string]
  operatorName: string
  jobId: string
  checkpointId: number
}) {
  const [expanded, setExpanded] = useState(false)
  const [subtasks, setSubtasks] = useState<CheckpointSubtaskStats[] | null>(
    null,
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleToggle = () => {
    if (!expanded && !subtasks && !loading) {
      setLoading(true)
      setError(null)
      fetchCheckpointSubtaskDetail(jobId, checkpointId, vid)
        .then((data) => {
          setSubtasks(data)
          setExpanded(true)
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : "Failed to load")
          setExpanded(true)
        })
        .finally(() => setLoading(false))
    } else {
      setExpanded(!expanded)
    }
  }

  const ackPct =
    task.numSubtasks > 0
      ? Math.round((task.numAcknowledgedSubtasks / task.numSubtasks) * 100)
      : 0

  // Compute min/avg/max from subtasks
  const summary = useMemo(() => {
    if (!subtasks || subtasks.length === 0) return null
    function minMaxAvg(vals: number[]) {
      const min = Math.min(...vals)
      const max = Math.max(...vals)
      const avg = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
      return { min, max, avg }
    }
    return {
      endToEndDuration: minMaxAvg(subtasks.map((s) => s.endToEndDuration)),
      checkpointedSize: minMaxAvg(subtasks.map((s) => s.checkpointedSize)),
      stateSize: minMaxAvg(subtasks.map((s) => s.stateSize)),
      syncDuration: minMaxAvg(subtasks.map((s) => s.syncDuration)),
      asyncDuration: minMaxAvg(subtasks.map((s) => s.asyncDuration)),
      processedData: minMaxAvg(subtasks.map((s) => s.processedData)),
      alignmentDuration: minMaxAvg(subtasks.map((s) => s.alignmentDuration)),
      startDelay: minMaxAvg(subtasks.map((s) => s.startDelay)),
    }
  }, [subtasks])

  return (
    <>
      <tr
        className="cursor-pointer border-b border-dash-border/50 transition-colors hover:bg-dash-hover"
        onClick={handleToggle}
      >
        <td className="px-3 py-2 text-zinc-300">
          <div className="flex items-center gap-1.5">
            {loading ? (
              <Spinner size="sm" className="shrink-0" />
            ) : expanded ? (
              <ChevronDown className="size-3 shrink-0 text-zinc-500" />
            ) : (
              <ChevronRight className="size-3 shrink-0 text-zinc-500" />
            )}
            <span className="truncate" title={operatorName}>
              {operatorName}
            </span>
          </div>
        </td>
        <td className="px-3 py-2">
          <Badge
            variant="outline"
            className={cn(
              "border-0 text-[10px]",
              task.status === "COMPLETED"
                ? "bg-job-finished/15 text-job-finished"
                : task.status === "FAILED"
                  ? "bg-job-failed/15 text-job-failed"
                  : "bg-job-running/15 text-job-running",
            )}
          >
            {task.status}
          </Badge>
        </td>
        <td className="px-3 py-2 tabular-nums text-zinc-400">
          {task.numAcknowledgedSubtasks}/{task.numSubtasks} ({ackPct}%)
        </td>
        <td className="px-3 py-2 tabular-nums text-zinc-400">
          {task.latestAckTimestamp > 0
            ? format(new Date(task.latestAckTimestamp), "HH:mm:ss")
            : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
          {formatDuration(task.endToEndDuration)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
          {task.checkpointedSize != null
            ? formatBytes(task.checkpointedSize)
            : "—"}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
          {formatBytes(task.stateSize)}
        </td>
        <td className="px-3 py-2 text-right tabular-nums text-zinc-400">
          {task.processedData != null ? formatBytes(task.processedData) : "—"}
        </td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-dash-surface/50 px-0 py-0">
            {error && (
              <div className="flex items-center gap-2 px-6 py-3 text-xs text-job-failed">
                <AlertTriangle className="size-3" />
                {error}
              </div>
            )}
            {subtasks && summary && (
              <div className="px-4 py-3">
                {/* Min/Avg/Max summary */}
                <table className="mb-2 w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-dash-border/30">
                      <th className="px-2 py-1 text-left font-medium text-zinc-600">
                        Summary
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Duration
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Ckpt Size
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Full Size
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Sync
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Async
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Data
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Alignment
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Start Delay
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {(["min", "avg", "max"] as const).map((stat) => (
                      <tr key={stat} className="border-b border-dash-border/20">
                        <td className="px-2 py-1 font-medium capitalize text-zinc-500">
                          {stat === "min"
                            ? "Minimum"
                            : stat === "avg"
                              ? "Average"
                              : "Maximum"}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(summary.endToEndDuration[stat])}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatBytes(summary.checkpointedSize[stat])}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatBytes(summary.stateSize[stat])}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(summary.syncDuration[stat])}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(summary.asyncDuration[stat])}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatBytes(summary.processedData[stat])}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(summary.alignmentDuration[stat])}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(summary.startDelay[stat])}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Individual subtask rows */}
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-dash-border/30">
                      <th className="px-2 py-1 text-left font-medium text-zinc-600">
                        #
                      </th>
                      <th className="px-2 py-1 text-left font-medium text-zinc-600">
                        Ack Time
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Duration
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Ckpt Size
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Full Size
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Sync
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Async
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Data
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Alignment
                      </th>
                      <th className="px-2 py-1 text-right font-medium text-zinc-600">
                        Start Delay
                      </th>
                      <th className="px-2 py-1 text-center font-medium text-zinc-600">
                        Unaligned
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {subtasks.map((s) => (
                      <tr
                        key={s.subtaskIndex}
                        className="border-b border-dash-border/20"
                      >
                        <td className="px-2 py-1 tabular-nums text-zinc-400">
                          {s.subtaskIndex}
                        </td>
                        <td className="px-2 py-1 tabular-nums text-zinc-400">
                          {s.ackTimestamp > 0
                            ? format(new Date(s.ackTimestamp), "HH:mm:ss.SSS")
                            : "—"}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(s.endToEndDuration)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatBytes(s.checkpointedSize)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatBytes(s.stateSize)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(s.syncDuration)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(s.asyncDuration)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatBytes(s.processedData)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(s.alignmentDuration)}
                        </td>
                        <td className="px-2 py-1 text-right tabular-nums text-zinc-400">
                          {formatDuration(s.startDelay)}
                        </td>
                        <td className="px-2 py-1 text-center tabular-nums text-zinc-400">
                          {s.unalignedCheckpoint ? "Yes" : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// CheckpointDetailView — drill-down for a single checkpoint
// ---------------------------------------------------------------------------

/**
 * Drill-down view for a single checkpoint showing overall summary, metadata
 * (type, external path, discarded status), and per-operator breakdown with
 * expandable subtask rows. Fetches detail data lazily via {@link fetchCheckpointDetail}.
 */
function CheckpointDetailView({
  jobId,
  checkpointId,
  onBack,
  vertexNames,
}: {
  jobId: string
  checkpointId: number
  onBack: () => void
  vertexNames: Record<string, string>
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
        <Spinner size="lg" />
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

  // Format checkpoint type for display
  const checkpointTypeLabel = detail.checkpointType
    ? detail.checkpointType === "CHECKPOINT"
      ? "Aligned Checkpoint"
      : detail.checkpointType === "UNALIGNED_CHECKPOINT"
        ? "Unaligned Checkpoint"
        : detail.checkpointType === "SAVEPOINT"
          ? "Savepoint"
          : detail.checkpointType
    : null

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

        {/* Checkpoint metadata */}
        {(checkpointTypeLabel ||
          detail.externalPath !== undefined ||
          detail.discarded !== undefined ||
          detail.checkpointedSize !== undefined) && (
          <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-dash-border/50 pt-3 text-xs lg:grid-cols-4">
            {checkpointTypeLabel && (
              <div>
                <span className="text-zinc-500">Type</span>
                <p className="text-zinc-200">{checkpointTypeLabel}</p>
              </div>
            )}
            {detail.externalPath !== undefined && (
              <div className="col-span-2">
                <span className="text-zinc-500">External Path</span>
                <p
                  className="truncate font-mono text-zinc-300"
                  title={detail.externalPath}
                >
                  {detail.externalPath || "not externally addressable"}
                </p>
              </div>
            )}
            {detail.discarded !== undefined && (
              <div>
                <span className="text-zinc-500">Discarded</span>
                <p className="text-zinc-200">
                  {detail.discarded ? "Yes" : "No"}
                </p>
              </div>
            )}
            {detail.checkpointedSize !== undefined && (
              <div>
                <span className="text-zinc-500">Checkpointed Size</span>
                <p className="font-medium tabular-nums text-zinc-200">
                  {formatBytes(detail.checkpointedSize)}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Per-operator breakdown */}
      {tasks.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-dash-border px-3 py-2">
            <h3 className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Operators
            </h3>
            <span className="ml-auto font-mono text-[10px] text-zinc-600">
              {tasks.length} operators
            </span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border">
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Operator
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Status
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Acknowledged
                </th>
                <th className="px-3 py-2 text-left font-medium text-zinc-500">
                  Latest Ack
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Duration
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Ckpt Size
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Full Size
                </th>
                <th className="px-3 py-2 text-right font-medium text-zinc-500">
                  Processed
                </th>
              </tr>
            </thead>
            <tbody>
              {tasks.map(([vid, t]) => (
                <ExpandableOperatorRow
                  key={vid}
                  vid={vid}
                  task={t}
                  operatorName={vertexNames[vid] ?? `${vid.slice(0, 12)}...`}
                  jobId={jobId}
                  checkpointId={checkpointId}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Stat item for counts bar
// ---------------------------------------------------------------------------

/** Single statistic in the checkpoint counts summary bar. */
function CountStat({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color?: string
}) {
  return (
    <div className="text-center">
      <p
        className={cn(
          "text-lg font-semibold tabular-nums",
          color ?? "text-zinc-200",
        )}
      >
        {value}
      </p>
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CheckpointsTab
// ---------------------------------------------------------------------------

/**
 * Full checkpoint tab showing counts bar, configuration summary, latest checkpoint
 * entries (completed, failed, savepoint, restore), a sortable checkpoint history
 * table with row-click drill-down, and size/duration trend sparklines. Clicking a
 * checkpoint row navigates to the {@link CheckpointDetailView} for per-operator breakdown.
 */
export function CheckpointsTab({
  jobId,
  checkpoints,
  counts,
  config,
  checkpointLatest,
  vertexNames,
}: {
  jobId: string
  checkpoints: Checkpoint[]
  counts: CheckpointCounts | null
  config: CheckpointConfig | null
  checkpointLatest?: CheckpointLatest | null
  vertexNames?: Record<string, string>
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
        vertexNames={vertexNames ?? {}}
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
    { key: "checkpointedSize", label: "Checkpointed Size" },
    { key: "size", label: "Full Size" },
    { key: "processedData", label: "Processed Data" },
  ]

  return (
    <div className="flex flex-col gap-4">
      {/* Checkpoint counts bar */}
      {counts && (
        <div className="glass-card flex items-center justify-around px-4 py-3">
          <CountStat
            label="Triggered"
            value={counts.triggered ?? counts.total}
          />
          <CountStat
            label="In Progress"
            value={counts.inProgress}
            color="text-job-running"
          />
          <CountStat
            label="Completed"
            value={counts.completed}
            color="text-job-finished"
          />
          <CountStat
            label="Failed"
            value={counts.failed}
            color={counts.failed > 0 ? "text-job-failed" : undefined}
          />
          <CountStat label="Restored" value={counts.restored ?? 0} />
        </div>
      )}

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
          {/* Externalization + Unaligned settings */}
          {(config.externalization !== undefined ||
            config.unalignedCheckpoints !== undefined) && (
            <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-2 border-t border-dash-border/50 pt-2 text-xs lg:grid-cols-5">
              {config.externalization !== undefined && (
                <div className="col-span-2">
                  <span className="text-zinc-500">Externalized</span>
                  <p className="font-medium text-zinc-200">
                    {config.externalization.enabled ? "Yes" : "No"}
                    {config.externalization.enabled &&
                      ` (delete on cancel: ${config.externalization.deleteOnCancellation ? "Yes" : "No"})`}
                  </p>
                </div>
              )}
              {config.unalignedCheckpoints !== undefined && (
                <div>
                  <span className="text-zinc-500">Unaligned</span>
                  <p className="font-medium text-zinc-200">
                    {config.unalignedCheckpoints ? "Yes" : "No"}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Latest completed checkpoint */}
      {checkpointLatest?.latestCompleted && (
        <div className="glass-card p-4">
          <h3 className="mb-3 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Latest Checkpoint
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-6">
            <div>
              <span className="text-zinc-500">ID</span>
              <p className="font-medium tabular-nums text-zinc-200">
                #{checkpointLatest.latestCompleted.id}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Status</span>
              <Badge
                variant="outline"
                className={cn(
                  "mt-0.5 border-0 text-[10px]",
                  checkpointStatusStyles[
                    checkpointLatest.latestCompleted.status
                  ],
                )}
              >
                {checkpointLatest.latestCompleted.status}
              </Badge>
            </div>
            <div>
              <span className="text-zinc-500">Completion Time</span>
              <p className="font-mono tabular-nums text-zinc-200">
                {format(
                  new Date(
                    checkpointLatest.latestCompleted.triggerTimestamp.getTime() +
                      checkpointLatest.latestCompleted.duration,
                  ),
                  "HH:mm:ss",
                )}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Duration</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatDuration(checkpointLatest.latestCompleted.duration)}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Checkpointed Size</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {checkpointLatest.latestCompleted.checkpointedSize != null
                  ? formatBytes(
                      checkpointLatest.latestCompleted.checkpointedSize,
                    )
                  : "—"}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Full Size</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatBytes(checkpointLatest.latestCompleted.size)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Latest failed checkpoint */}
      {checkpointLatest?.latestFailed && (
        <div className="glass-card border-job-failed/20 p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-job-failed">
            <AlertTriangle className="size-3" />
            Latest Failed Checkpoint
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-4">
            <div>
              <span className="text-zinc-500">ID</span>
              <p className="font-medium tabular-nums text-zinc-200">
                #{checkpointLatest.latestFailed.id}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Timestamp</span>
              <p className="font-mono tabular-nums text-zinc-200">
                {format(
                  checkpointLatest.latestFailed.triggerTimestamp,
                  "HH:mm:ss",
                )}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Duration</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatDuration(checkpointLatest.latestFailed.duration)}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">State Size</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatBytes(checkpointLatest.latestFailed.size)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Latest savepoint */}
      {checkpointLatest?.latestSavepoint && (
        <div className="glass-card p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-fr-amber">
            <Save className="size-3" />
            Latest Savepoint
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-4">
            <div>
              <span className="text-zinc-500">ID</span>
              <p className="font-medium tabular-nums text-zinc-200">
                #{checkpointLatest.latestSavepoint.id}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Trigger Time</span>
              <p className="font-mono tabular-nums text-zinc-200">
                {format(
                  checkpointLatest.latestSavepoint.triggerTimestamp,
                  "HH:mm:ss",
                )}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">State Size</span>
              <p className="font-medium tabular-nums text-zinc-200">
                {formatBytes(checkpointLatest.latestSavepoint.size)}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Latest restore */}
      {checkpointLatest?.latestRestore && (
        <div className="glass-card p-4">
          <h3 className="mb-3 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-400">
            <RotateCcw className="size-3" />
            Latest Restore
          </h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs lg:grid-cols-4">
            <div>
              <span className="text-zinc-500">Source ID</span>
              <p className="font-medium tabular-nums text-zinc-200">
                #{checkpointLatest.latestRestore.id}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Restore Time</span>
              <p className="font-mono tabular-nums text-zinc-200">
                {format(
                  checkpointLatest.latestRestore.restoreTimestamp,
                  "HH:mm:ss",
                )}
              </p>
            </div>
            <div>
              <span className="text-zinc-500">Source Type</span>
              <p className="text-zinc-200">
                {checkpointLatest.latestRestore.isSavepoint
                  ? "Savepoint"
                  : "Checkpoint"}
              </p>
            </div>
            {checkpointLatest.latestRestore.externalPath && (
              <div>
                <span className="text-zinc-500">Path</span>
                <p
                  className="truncate font-mono text-zinc-300"
                  title={checkpointLatest.latestRestore.externalPath}
                >
                  {checkpointLatest.latestRestore.externalPath}
                </p>
              </div>
            )}
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
                    {cp.checkpointedSize != null && cp.checkpointedSize > 0
                      ? formatBytes(cp.checkpointedSize)
                      : "—"}
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
