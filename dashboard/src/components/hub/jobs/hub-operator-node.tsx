/**
 * Hub-styled ReactFlow operator node.
 *
 * Direct port of `console-v2/shared/job-dag.js` `OperatorNode` — same DOM
 * shape, same class names, same data fields. The CSS lives in
 * `packages/ui/src/styles/hub.css` under `.fr-op-node`. Do not deviate from
 * the mockup contract: header (icon | name | pill) + 4×2 metrics grid
 * (parallelism, records in/out, duration, bytes in/out, busy, backpressure)
 * + bottom task-bar (proportional segments by task status).
 */
"use client"

import type { JobVertex, TaskCounts } from "@flink-reactor/ui"
import { Handle, type NodeProps, Position } from "@xyflow/react"

interface HubOperatorNodeData {
  vertex: JobVertex
  onSelectVertex?: (id: string) => void
}

// ─── Compact formatters (match console-v2/shared/job-dag.js) ─────────

function fmtCount(n: number | null | undefined): string {
  if (n == null) return "—"
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return String(n | 0)
}

function fmtBytes(b: number | null | undefined): string {
  if (b == null) return "—"
  if (b >= 1e12) return `${(b / 1e12).toFixed(2)}TB`
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)}GB`
  if (b >= 1e6) return `${(b / 1e6).toFixed(1)}MB`
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)}KB`
  return `${b | 0}B`
}

function fmtMsPerS(ms: number | null | undefined): string {
  if (ms == null) return "—"
  if (ms >= 1000) return `${(ms / 1000).toFixed(2)}s/s`
  return `${Math.round(ms)}ms/s`
}

function fmtDuration(ms: number | null | undefined): string {
  if (ms == null) return "—"
  /* JobVertex.duration is milliseconds — convert to seconds, then bucket. */
  const s = ms / 1000
  if (s >= 86400) return `${(s / 86400).toFixed(1)}d`
  if (s >= 3600) return `${(s / 3600).toFixed(1)}h`
  if (s >= 60) return `${(s / 60).toFixed(1)}m`
  return `${Math.round(s)}s`
}

// ─── Vertex classification by name prefix ─────────────────────────────

type Kind = "source" | "sink" | "shuffle" | "op"

function vertexKind(name: string): Kind {
  if (!name) return "op"
  if (name.startsWith("Source:")) return "source"
  if (name.startsWith("Sink:")) return "sink"
  if (/shuffle|hash|rebalance/i.test(name)) return "shuffle"
  return "op"
}

function splitName(
  name: string,
): { prefix: string | null; rest: string } {
  const m = name?.match(/^([A-Z][a-zA-Z]+:)\s*(.*)$/)
  if (m) return { prefix: m[1], rest: m[2] }
  return { prefix: null, rest: name }
}

// ─── Backpressure severity from busy ms/s ────────────────────────────

function bpLevel(busyMsPerS: number | null | undefined): "ok" | "warn" | "crit" {
  if (busyMsPerS == null) return "ok"
  if (busyMsPerS >= 600) return "crit"
  if (busyMsPerS >= 300) return "warn"
  return "ok"
}

function bpColor(busyMsPerS: number | null | undefined): "sage" | "amber" | "rose" {
  const lvl = bpLevel(busyMsPerS)
  return lvl === "crit" ? "rose" : lvl === "warn" ? "amber" : "sage"
}

// ─── Inline icon SVGs ────────────────────────────────────────────────
//
// Class names are prefixed `kind-*` (not bare `source`/`sink`/`op`/`shuffle`)
// because xyflow's `getHandleBounds` measures handles via
// `nodeElement.querySelectorAll('.source')` / `.target`. A bare `source`
// class on the icon SVG would collide with the source handle and xyflow
// would pick the icon's 14×14 rect (top-left of the header) as the source
// handle bounds — producing edges that start from inside the icon instead
// of the right-edge handle. Only source vertices were affected because
// only `source` and `target` collide; the rename is consistent across all
// kinds to keep the scheme uniform.

function SourceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="icon kind-source"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  )
}

function SinkIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="icon kind-sink"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function OpIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="icon kind-op"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}

function ShuffleIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="icon kind-shuffle"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="18" cy="18" r="3" />
      <circle cx="6" cy="6" r="3" />
      <path d="M6 21V9a9 9 0 0 0 9 9" />
    </svg>
  )
}

const ICON_BY_KIND: Record<Kind, () => React.JSX.Element> = {
  source: SourceIcon,
  sink: SinkIcon,
  shuffle: ShuffleIcon,
  op: OpIcon,
}

// ─── Component ───────────────────────────────────────────────────────

const TASK_KEYS: (keyof TaskCounts)[] = [
  "pending",
  "running",
  "finished",
  "canceling",
  "failed",
]

/* Map domain TaskCounts ("pending") to mockup CSS class names ("created"). */
const TASK_CSS_CLASS: Record<keyof TaskCounts, string> = {
  pending: "created",
  running: "running",
  finished: "finished",
  canceling: "canceling",
  failed: "failed",
}

export function HubOperatorNode({
  data,
}: NodeProps & { data: HubOperatorNodeData }) {
  const v = data.vertex
  const kind = vertexKind(v.name)
  const Icon = ICON_BY_KIND[kind]
  const bp = bpLevel(v.metrics.busyTimeMsPerSecond)
  const { prefix, rest } = splitName(v.name)

  /* Status pill */
  const statusKey = (v.status ?? "running").toLowerCase()
  const statusLabel = (v.status ?? "RUNNING").toUpperCase()

  /* Mini task bar — synthesize from parallelism + status if real counts unset */
  const totalCounts = (Object.values(v.tasks) as number[]).reduce(
    (a, b) => a + b,
    0,
  )
  const tasks: TaskCounts =
    totalCounts > 0
      ? v.tasks
      : (() => {
          const total = v.parallelism || 1
          if (statusKey === "failed") return { pending: 0, running: 0, finished: 0, canceling: 0, failed: total }
          if (statusKey === "finished") return { pending: 0, running: 0, finished: total, canceling: 0, failed: 0 }
          if (statusKey === "canceled") return { pending: 0, running: 0, finished: 0, canceling: total, failed: 0 }
          if (statusKey === "created") return { pending: total, running: 0, finished: 0, canceling: 0, failed: 0 }
          return { pending: 0, running: total, finished: 0, canceling: 0, failed: 0 }
        })()
  const totalTasks = TASK_KEYS.reduce((s, k) => s + tasks[k], 0)

  return (
    <div className="fr-op-node" data-bp={bp}>
      <Handle type="target" position={Position.Left} />
      {/* Header row */}
      <div className="head">
          <Icon />
          <div className="name" title={v.name}>
            {prefix ? <span className="prefix">{prefix} </span> : null}
            {rest}
          </div>
          <span className={`pill ${statusKey}`}>
            {statusKey === "running" ? <span className="live-dot" /> : null}
            {statusLabel}
          </span>
        </div>

        {/* 4×2 metrics grid */}
        <div className="metrics">
          <Metric label="parallelism" value={`×${v.parallelism || 1}`} />
          <Metric label="records in" value={fmtCount(v.metrics.recordsIn)} />
          <Metric label="records out" value={fmtCount(v.metrics.recordsOut)} />
          <Metric
            label="duration"
            value={fmtDuration(v.duration)}
            tone="muted"
          />
          <Metric
            label="bytes in"
            value={fmtBytes(v.metrics.bytesIn)}
            tone="muted"
          />
          <Metric
            label="bytes out"
            value={fmtBytes(v.metrics.bytesOut)}
            tone="muted"
          />
          <Metric
            label="busy"
            value={fmtMsPerS(v.metrics.busyTimeMsPerSecond)}
            tone={bpColor(v.metrics.busyTimeMsPerSecond)}
          />
          <Metric
            label="backpressure"
            value={fmtMsPerS(v.metrics.backPressuredTimeMsPerSecond)}
            tone={bpColor(v.metrics.backPressuredTimeMsPerSecond)}
          />
        </div>

        {/* Task bar */}
        <div className="task-bar" title={`${totalTasks} subtasks`}>
          {TASK_KEYS.map((k) =>
            tasks[k] ? (
              <div
                key={k}
                className={`seg ${TASK_CSS_CLASS[k]}`}
                style={{ width: `${(tasks[k] / Math.max(1, totalTasks)) * 100}%` }}
              />
            ) : null,
          )}
        </div>
      <Handle type="source" position={Position.Right} />
    </div>
  )
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: "muted" | "sage" | "amber" | "rose"
}) {
  return (
    <div className="metric">
      <div className="label">{label}</div>
      <div className={tone ? `value ${tone}` : "value"}>{value}</div>
    </div>
  )
}
