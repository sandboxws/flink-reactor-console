import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { Radio } from "lucide-react"
import type { IconType } from "react-icons"
import {
  PiArrowFatLinesDownBold,
  PiArrowFatLinesUpBold,
  PiCpuBold,
  PiDownloadSimpleBold,
  PiGaugeBold,
  PiHeartbeatBold,
  PiTimerBold,
  PiUploadSimpleBold,
} from "react-icons/pi"
import {
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card"
import type {
  JobVertex,
  JobVertexStatus,
  TaskStatus,
} from "@/data/cluster-types"
import type { TapMetadata } from "@/data/tap-types"
import { cn } from "@/lib/cn"
import type { ActiveTapSession } from "@/stores/sql-gateway-store"

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatSI(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

// ---------------------------------------------------------------------------
// Node type detection + color tokens
// ---------------------------------------------------------------------------

type NodeType = "source" | "sink" | "operator"

function parseNodeType(name: string): { type: NodeType; displayName: string } {
  if (name.startsWith("Source: "))
    return { type: "source", displayName: name.slice(8) }
  if (name.startsWith("Sink: "))
    return { type: "sink", displayName: name.slice(6) }
  return { type: "operator", displayName: name }
}

const METRIC_ICONS: Record<string, IconType> = {
  Status: PiHeartbeatBold,
  Duration: PiTimerBold,
  "Records In": PiArrowFatLinesDownBold,
  "Records Out": PiArrowFatLinesUpBold,
  "Bytes In": PiDownloadSimpleBold,
  "Bytes Out": PiUploadSimpleBold,
  "Busy Time": PiCpuBold,
  Backpressure: PiGaugeBold,
}

const NODE_TYPE_COLORS = {
  source: {
    bg: "bg-fr-coral/10",
    text: "text-fr-coral",
    border: "border-t-fr-coral",
  },
  sink: {
    bg: "bg-fr-amber/10",
    text: "text-fr-amber",
    border: "border-t-fr-amber",
  },
  operator: {
    bg: "bg-fr-purple/10",
    text: "text-fr-purple",
    border: "border-t-fr-purple",
  },
} as const

// ---------------------------------------------------------------------------
// Mini task-status bar (same colors as TaskCountsBar)
// ---------------------------------------------------------------------------

const segments: { key: TaskStatus; color: string }[] = [
  { key: "pending", color: "bg-job-created" },
  { key: "running", color: "bg-job-running" },
  { key: "finished", color: "bg-job-finished" },
  { key: "canceling", color: "bg-job-cancelled" },
  { key: "failed", color: "bg-job-failed" },
]

function MiniTaskBar({ vertex }: { vertex: JobVertex }) {
  const total = Object.values(vertex.tasks).reduce((a, b) => a + b, 0)
  if (total === 0) return null

  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
      {segments.map(
        (seg) =>
          vertex.tasks[seg.key] > 0 && (
            <div
              key={seg.key}
              className={cn("h-full", seg.color)}
              style={{ width: `${(vertex.tasks[seg.key] / total) * 100}%` }}
            />
          ),
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Back-pressure indicator color (for left border)
// ---------------------------------------------------------------------------

function bpColor(busyTimeMsPerSecond: number): string {
  const pct = busyTimeMsPerSecond / 10 // ms/s → percentage (0-100)
  if (pct < 30) return "border-l-job-running" // green
  if (pct < 60) return "border-l-fr-amber" // amber
  return "border-l-job-failed" // red
}

// ---------------------------------------------------------------------------
// Back-pressure text color (for metric value)
// ---------------------------------------------------------------------------

function bpTextColor(backPressuredMsPerSecond: number): string {
  if (backPressuredMsPerSecond < 300) return "text-job-running"
  if (backPressuredMsPerSecond < 600) return "text-fr-amber"
  return "text-job-failed"
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

const STATUS_DOT_COLORS: Record<JobVertexStatus, string> = {
  RUNNING: "bg-job-running",
  FINISHED: "bg-job-finished",
  FAILED: "bg-job-failed",
  CANCELED: "bg-job-cancelled",
  CREATED: "bg-job-created",
}

function StatusDot({ status }: { status: JobVertexStatus }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        STATUS_DOT_COLORS[status] ?? "bg-zinc-500",
      )}
    />
  )
}

// ---------------------------------------------------------------------------
// OperatorNode
// ---------------------------------------------------------------------------

type OperatorNodeData = {
  vertex: JobVertex
  onSelectVertex?: (vertexId: string) => void
  tapMetadata?: TapMetadata
  tapSessionStatus?: ActiveTapSession["status"]
  onTapInto?: (vertexId: string) => void
  onStopTap?: (vertexId: string) => void
}

export function OperatorNode({ data }: NodeProps & { data: OperatorNodeData }) {
  const { vertex } = data
  const { metrics } = vertex
  const { type, displayName } = parseNodeType(vertex.name)
  const colors = NODE_TYPE_COLORS[type]

  const nodeContent = (
    <div
      title=""
      className="relative z-10 w-[320px] overflow-hidden rounded-xl border border-white/6 bg-dash-panel"
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-dash-border !border-dash-elevated !size-2"
      />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className={cn("flex items-center gap-2 px-3 py-2", colors.bg)}>
        <StatusDot status={vertex.status} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">
          {displayName}
        </span>
        {data.tapMetadata && (
          <Radio
            className={cn(
              "size-3 shrink-0",
              data.tapSessionStatus === "streaming"
                ? "text-job-running animate-pulse"
                : data.tapSessionStatus === "paused"
                  ? "text-fr-amber"
                  : "text-zinc-400 opacity-40",
            )}
          />
        )}
        <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
          {formatDuration(vertex.duration)}
        </span>
      </div>

      {/* ── Body: metric grid ──────────────────────────────────── */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-[10px]">
        <span className="text-zinc-500">Parallelism</span>
        <span className="text-right tabular-nums text-zinc-300">
          &times;{vertex.parallelism}
        </span>
        <span className="text-zinc-500">Records In</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatSI(metrics.recordsIn)}
        </span>

        <span className="text-zinc-500">Records Out</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatSI(metrics.recordsOut)}
        </span>
        <span className="text-zinc-500">Bytes In</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatBytes(metrics.bytesIn)}
        </span>

        <span className="text-zinc-500">Bytes Out</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatBytes(metrics.bytesOut)}
        </span>
        <span className="text-zinc-500">Busy</span>
        <span className="text-right tabular-nums text-zinc-300">
          {metrics.busyTimeMsPerSecond} ms/s
        </span>

        <span className="text-zinc-500">Backpressure</span>
        <span
          className={cn(
            "text-right tabular-nums",
            bpTextColor(metrics.backPressuredTimeMsPerSecond),
          )}
        >
          {metrics.backPressuredTimeMsPerSecond} ms/s
        </span>
      </div>

      {/* ── Footer: task bar + action link ────────────────────── */}
      <div className="px-3 pb-2">
        <MiniTaskBar vertex={vertex} />
      </div>

      {data.onSelectVertex && (
        <div className="border-t border-white/5 px-3 py-1.5">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              data.onSelectVertex?.(vertex.id)
            }}
            className="text-[10px] text-zinc-500 hover:text-fr-purple transition-colors"
          >
            View details &rarr;
          </button>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-dash-border !border-dash-elevated !size-2"
      />
    </div>
  )

  return (
    <HoverCard openDelay={400} closeDelay={150}>
      <HoverCardTrigger asChild>{nodeContent}</HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-72 p-0 overflow-hidden bg-dash-panel border-dash-border"
      >
        <HoverCardArrow className="fill-dash-panel" />

        {/* ── Hover header ──────────────────────────────────────── */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="font-semibold text-sm text-zinc-100">
            {vertex.name}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className={cn("text-xs font-medium capitalize", colors.text)}>
              {type}
            </span>
            <span className="text-xs text-zinc-500">
              &times;{vertex.parallelism} parallelism
            </span>
          </div>
        </div>

        {/* ── Hover metrics ─────────────────────────────────────── */}
        <div className="px-3 py-2 border-b border-white/5">
          <div className="space-y-1.5">
            {(
              [
                ["Status", vertex.status],
                ["Duration", formatDuration(vertex.duration)],
                ["Records In", formatSI(metrics.recordsIn)],
                ["Records Out", formatSI(metrics.recordsOut)],
                ["Bytes In", formatBytes(metrics.bytesIn)],
                ["Bytes Out", formatBytes(metrics.bytesOut)],
                ["Busy Time", `${metrics.busyTimeMsPerSecond} ms/s`],
                [
                  "Backpressure",
                  `${metrics.backPressuredTimeMsPerSecond} ms/s`,
                ],
              ] as const
            ).map(([label, value]) => {
              const MIcon = METRIC_ICONS[label]
              return (
                <div
                  key={label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="flex items-center gap-1.5 text-zinc-400">
                    {MIcon && (
                      <MIcon className="h-3 w-3 shrink-0 text-zinc-500" />
                    )}
                    {label}
                  </span>
                  <span
                    className={cn(
                      "text-zinc-200 font-mono text-[11px]",
                      label === "Backpressure" &&
                        bpTextColor(metrics.backPressuredTimeMsPerSecond),
                    )}
                  >
                    {value}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Task breakdown ────────────────────────────────────── */}
        <div className="px-3 py-2">
          <div className="text-[10px] font-medium text-zinc-400 uppercase tracking-wider mb-1">
            Tasks
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
            {segments
              .filter((seg) => vertex.tasks[seg.key] > 0)
              .map((seg) => (
                <div key={seg.key} className="flex items-center gap-1">
                  <span
                    className={cn(
                      "inline-block size-2 rounded-full",
                      seg.color,
                    )}
                  />
                  <span className="text-zinc-400 capitalize">{seg.key}</span>
                  <span className="text-zinc-200 font-mono text-[11px]">
                    {vertex.tasks[seg.key]}
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* ── Tap section ──────────────────────────────────────── */}
        {data.tapMetadata && !data.tapSessionStatus && data.onTapInto && (
          <div className="border-t border-white/5 px-3 py-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data.onTapInto?.(vertex.name)
              }}
              className="text-[10px] text-zinc-500 hover:text-fr-purple transition-colors"
            >
              Tap into &rarr;
            </button>
          </div>
        )}

        {data.tapMetadata &&
          (data.tapSessionStatus === "streaming" ||
            data.tapSessionStatus === "paused") && (
            <div className="border-t border-white/5 px-3 py-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="relative flex size-2">
                    {data.tapSessionStatus === "streaming" && (
                      <span className="absolute inline-flex size-full animate-ping rounded-full bg-job-running opacity-75" />
                    )}
                    <span
                      className={cn(
                        "relative inline-flex size-2 rounded-full",
                        data.tapSessionStatus === "streaming"
                          ? "bg-job-running"
                          : "bg-fr-amber",
                      )}
                    />
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {data.tapSessionStatus === "streaming"
                      ? "Streaming"
                      : "Paused"}
                  </span>
                </div>
                {data.onStopTap && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      data.onStopTap?.(vertex.name)
                    }}
                    className="text-[10px] text-zinc-500 hover:text-job-failed transition-colors"
                  >
                    Stop tap
                  </button>
                )}
              </div>
            </div>
          )}
      </HoverCardContent>
    </HoverCard>
  )
}
