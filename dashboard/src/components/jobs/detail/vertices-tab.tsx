import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  EmptyState,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import { ChevronRight, Layers } from "lucide-react"
import { useMemo, useState } from "react"
import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import type {
  FlinkJob,
  JobVertex,
  SubtaskMetrics,
  UserAccumulator,
  VertexBackPressure,
  VertexWatermark,
} from "@flink-reactor/ui"
import { cn } from "@/lib/cn"

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

function formatTimestamp(epoch: number): string {
  if (!Number.isFinite(epoch) || epoch <= 0) return "No Watermark"
  return new Date(epoch).toLocaleTimeString()
}

// ---------------------------------------------------------------------------
// Sort helpers
// ---------------------------------------------------------------------------

type SortDir = "asc" | "desc"
type SortKey = keyof SubtaskMetrics

function sortedSubtasks(
  subtasks: SubtaskMetrics[],
  key: SortKey,
  dir: SortDir,
): SubtaskMetrics[] {
  return [...subtasks].sort((a, b) => {
    const aVal = a[key]
    const bVal = b[key]
    if (typeof aVal === "number" && typeof bVal === "number") {
      return dir === "asc" ? aVal - bVal : bVal - aVal
    }
    return dir === "asc"
      ? String(aVal).localeCompare(String(bVal))
      : String(bVal).localeCompare(String(aVal))
  })
}

// ---------------------------------------------------------------------------
// SortHeader — clickable column header
// ---------------------------------------------------------------------------

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string
  sortKey: SortKey
  currentKey: SortKey
  currentDir: SortDir
  onSort: (key: SortKey) => void
  className?: string
}) {
  const isActive = currentKey === sortKey
  return (
    <TableHead className={cn("cursor-pointer select-none", className)}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 text-xs",
          className?.includes("text-right") && "ml-auto",
        )}
        onClick={() => onSort(sortKey)}
      >
        {label}
        {isActive && (
          <span className="text-[10px] text-zinc-400">
            {currentDir === "asc" ? "\u25B2" : "\u25BC"}
          </span>
        )}
      </button>
    </TableHead>
  )
}

// ---------------------------------------------------------------------------
// BackPressure level badge
// ---------------------------------------------------------------------------

const BP_COLORS = {
  ok: "bg-job-running/20 text-job-running",
  low: "bg-fr-amber/20 text-fr-amber",
  high: "bg-job-failed/20 text-job-failed",
} as const

function BpBadge({ level }: { level: "ok" | "low" | "high" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase",
        BP_COLORS[level],
      )}
    >
      {level}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Detail sub-tab
// ---------------------------------------------------------------------------

function DetailSection({
  vertex,
  // biome-ignore lint/correctness/noUnusedFunctionParameters: reserved for future per-subtask metrics display
  subtasks,
}: {
  vertex: JobVertex
  subtasks: SubtaskMetrics[]
}) {
  const { metrics, tasks } = vertex
  const total = Object.values(tasks).reduce((a, b) => a + b, 0)

  const taskSegments = [
    { label: "Pending", count: tasks.pending, color: "bg-job-created" },
    { label: "Running", count: tasks.running, color: "bg-job-running" },
    { label: "Finished", count: tasks.finished, color: "bg-job-finished" },
    { label: "Canceling", count: tasks.canceling, color: "bg-job-cancelled" },
    { label: "Failed", count: tasks.failed, color: "bg-job-failed" },
  ]

  const stats = [
    { label: "Status", value: vertex.status },
    { label: "Parallelism", value: `\u00d7${vertex.parallelism}` },
    { label: "Duration", value: formatDuration(vertex.duration) },
    { label: "Start Time", value: new Date(vertex.startTime).toLocaleString() },
    { label: "Records In", value: formatSI(metrics.recordsIn) },
    { label: "Records Out", value: formatSI(metrics.recordsOut) },
    { label: "Bytes In", value: formatBytes(metrics.bytesIn) },
    { label: "Bytes Out", value: formatBytes(metrics.bytesOut) },
    { label: "Busy Time", value: `${metrics.busyTimeMsPerSecond} ms/s` },
    {
      label: "Backpressure",
      value: `${metrics.backPressuredTimeMsPerSecond} ms/s`,
    },
  ]

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Vertex Overview
        </h3>
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 sm:grid-cols-3 lg:grid-cols-5">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col gap-0.5">
              <span className="text-[10px] text-zinc-500">{s.label}</span>
              <span className="text-xs font-medium tabular-nums text-zinc-200">
                {s.value}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card p-4">
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Task Breakdown
        </h3>
        {/* Bar */}
        <div className="mb-2 flex h-2 overflow-hidden rounded-full bg-white/5">
          {taskSegments.map(
            (seg) =>
              seg.count > 0 && (
                <div
                  key={seg.label}
                  className={cn("h-full", seg.color)}
                  style={{ width: `${(seg.count / total) * 100}%` }}
                />
              ),
          )}
        </div>
        {/* Legend */}
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {taskSegments
            .filter((s) => s.count > 0)
            .map((s) => (
              <div key={s.label} className="flex items-center gap-1.5 text-xs">
                <span className={cn("size-2 rounded-full", s.color)} />
                <span className="text-zinc-400">{s.label}</span>
                <span className="font-mono text-[11px] text-zinc-200">
                  {s.count}
                </span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// SubTasks sub-tab
// ---------------------------------------------------------------------------

function SubTasksSection({ subtasks }: { subtasks: SubtaskMetrics[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("subtaskIndex")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
  }

  const sorted = useMemo(
    () => sortedSubtasks(subtasks, sortKey, sortDir),
    [subtasks, sortKey, sortDir],
  )

  const columns: {
    label: string
    key: SortKey
    align?: string
    format: (s: SubtaskMetrics) => string
  }[] = [
    { label: "ID", key: "subtaskIndex", format: (s) => String(s.subtaskIndex) },
    { label: "Status", key: "status", format: (s) => s.status },
    { label: "Attempt", key: "attempt", format: (s) => String(s.attempt) },
    { label: "Host", key: "endpoint", format: (s) => s.endpoint },
    {
      label: "Duration",
      key: "duration",
      format: (s) => formatDuration(s.duration),
    },
    {
      label: "Records In",
      key: "recordsIn",
      align: "text-right",
      format: (s) => formatSI(s.recordsIn),
    },
    {
      label: "Records Out",
      key: "recordsOut",
      align: "text-right",
      format: (s) => formatSI(s.recordsOut),
    },
    {
      label: "Bytes In",
      key: "bytesIn",
      align: "text-right",
      format: (s) => formatBytes(s.bytesIn),
    },
    {
      label: "Bytes Out",
      key: "bytesOut",
      align: "text-right",
      format: (s) => formatBytes(s.bytesOut),
    },
    {
      label: "Busy ms/s",
      key: "busyTimeMsPerSecond",
      align: "text-right",
      format: (s) => String(s.busyTimeMsPerSecond),
    },
  ]

  return (
    <div className="glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            {columns.map((col) => (
              <SortHeader
                key={col.key}
                label={col.label}
                sortKey={col.key}
                currentKey={sortKey}
                currentDir={sortDir}
                onSort={handleSort}
                className={col.align}
              />
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((s) => (
            <TableRow key={s.subtaskIndex}>
              {columns.map((col) => (
                <TableCell
                  key={col.key}
                  className={cn("text-xs tabular-nums", col.align)}
                >
                  {col.format(s)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TaskManagers sub-tab
// ---------------------------------------------------------------------------

function TaskManagersSection({ subtasks }: { subtasks: SubtaskMetrics[] }) {
  const grouped = useMemo(() => {
    const map = new Map<string, SubtaskMetrics[]>()
    for (const s of subtasks) {
      const list = map.get(s.taskManagerId) ?? []
      list.push(s)
      map.set(s.taskManagerId, list)
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b))
  }, [subtasks])

  if (grouped.length === 0) {
    return <EmptyState icon={Layers} message="No task manager data" />
  }

  return (
    <div className="flex flex-col gap-2">
      {grouped.map(([tmId, tmSubtasks]) => (
        <Collapsible key={tmId} defaultOpen>
          <CollapsibleTrigger className="glass-card flex w-full items-center gap-2 px-4 py-2.5 text-left text-xs hover:bg-dash-hover transition-colors group">
            <ChevronRight className="size-3.5 text-zinc-500 transition-transform group-data-[state=open]:rotate-90" />
            <span className="font-medium text-zinc-200">{tmId}</span>
            <span className="text-zinc-500">
              {tmSubtasks.length} subtask{tmSubtasks.length !== 1 ? "s" : ""}
            </span>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="glass-card mt-px overflow-hidden rounded-t-none">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>ID</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead className="text-right">Records In</TableHead>
                    <TableHead className="text-right">Records Out</TableHead>
                    <TableHead className="text-right">Busy ms/s</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tmSubtasks.map((s) => (
                    <TableRow key={s.subtaskIndex}>
                      <TableCell className="text-xs tabular-nums">
                        {s.subtaskIndex}
                      </TableCell>
                      <TableCell className="text-xs">{s.status}</TableCell>
                      <TableCell className="text-xs tabular-nums">
                        {formatDuration(s.duration)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatSI(s.recordsIn)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {formatSI(s.recordsOut)}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">
                        {s.busyTimeMsPerSecond}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Watermarks sub-tab
// ---------------------------------------------------------------------------

function WatermarksSection({ watermarks }: { watermarks: VertexWatermark[] }) {
  if (watermarks.length === 0) {
    return <EmptyState icon={Layers} message="No watermark data available" />
  }

  const validWms = watermarks.filter(
    (w) => Number.isFinite(w.watermark) && w.watermark > 0,
  )
  const minWm =
    validWms.length > 0 ? Math.min(...validWms.map((w) => w.watermark)) : null
  const maxWm =
    validWms.length > 0 ? Math.max(...validWms.map((w) => w.watermark)) : null

  return (
    <div className="flex flex-col gap-4">
      {minWm !== null && maxWm !== null && (
        <div className="grid grid-cols-2 gap-2">
          <div className="glass-card flex flex-col items-center gap-0.5 p-3">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Min Watermark
            </span>
            <span className="text-sm font-medium tabular-nums text-zinc-200">
              {formatTimestamp(minWm)}
            </span>
          </div>
          <div className="glass-card flex flex-col items-center gap-0.5 p-3">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Max Watermark
            </span>
            <span className="text-sm font-medium tabular-nums text-zinc-200">
              {formatTimestamp(maxWm)}
            </span>
          </div>
        </div>
      )}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subtask Index</TableHead>
              <TableHead>Watermark</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {watermarks.map((w) => (
              <TableRow key={w.subtaskIndex}>
                <TableCell className="text-xs tabular-nums">
                  {w.subtaskIndex}
                </TableCell>
                <TableCell className="text-xs tabular-nums">
                  {formatTimestamp(w.watermark)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// BackPressure sub-tab
// ---------------------------------------------------------------------------

function BackPressureSection({ bp }: { bp: VertexBackPressure | undefined }) {
  if (!bp || bp.subtasks.length === 0) {
    return <EmptyState icon={Layers} message="No backpressure data available" />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Overall level */}
      <div className="glass-card flex items-center gap-3 p-4">
        <span className="text-xs text-zinc-500">Overall Level:</span>
        <BpBadge level={bp.level} />
      </div>

      {/* Per-subtask table */}
      <div className="glass-card overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Subtask</TableHead>
              <TableHead>Level</TableHead>
              <TableHead className="text-right">Ratio</TableHead>
              <TableHead className="text-right">Busy Ratio</TableHead>
              <TableHead className="text-right">Idle Ratio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {bp.subtasks.map((s) => (
              <TableRow key={s.subtaskIndex}>
                <TableCell className="text-xs tabular-nums">
                  {s.subtaskIndex}
                </TableCell>
                <TableCell>
                  <BpBadge level={s.level} />
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {(s.ratio * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {(s.busyRatio * 100).toFixed(1)}%
                </TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {(s.idleRatio * 100).toFixed(1)}%
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Accumulators sub-tab
// ---------------------------------------------------------------------------

function AccumulatorsSection({
  accumulators,
}: {
  accumulators: UserAccumulator[]
}) {
  if (accumulators.length === 0) {
    return <EmptyState icon={Layers} message="No user accumulators" />
  }

  return (
    <div className="glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Type</TableHead>
            <TableHead className="text-right">Value</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {accumulators.map((a) => (
            <TableRow key={a.name}>
              <TableCell className="text-xs font-medium text-zinc-200">
                {a.name}
              </TableCell>
              <TableCell className="text-xs text-zinc-400">{a.type}</TableCell>
              <TableCell className="text-right text-xs tabular-nums">
                {a.value}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Metrics sub-tab — bar chart comparing subtask values
// ---------------------------------------------------------------------------

type MetricChoice =
  | "recordsIn"
  | "recordsOut"
  | "bytesIn"
  | "bytesOut"
  | "busyTimeMsPerSecond"
  | "backPressuredTimeMsPerSecond"
const METRIC_OPTIONS: { key: MetricChoice; label: string }[] = [
  { key: "recordsIn", label: "Records In" },
  { key: "recordsOut", label: "Records Out" },
  { key: "bytesIn", label: "Bytes In" },
  { key: "bytesOut", label: "Bytes Out" },
  { key: "busyTimeMsPerSecond", label: "Busy Time" },
  { key: "backPressuredTimeMsPerSecond", label: "Backpressure" },
]

function MetricsChartTooltip({
  active,
  payload,
}: {
  active?: boolean
  payload?: Array<{
    value: number
    payload: { subtask: string; value: number }
  }>
}) {
  if (!active || !payload?.length) return null
  const data = payload[0].payload
  return (
    <div
      className="rounded-md border border-dash-border px-2 py-1.5"
      style={{ backgroundColor: "var(--color-dash-panel)" }}
    >
      <p className="text-[10px] text-fg-muted">Subtask {data.subtask}</p>
      <p className="text-[10px] text-fg-secondary">{formatSI(data.value)}</p>
    </div>
  )
}

function MetricsSection({ subtasks }: { subtasks: SubtaskMetrics[] }) {
  const [metric, setMetric] = useState<MetricChoice>("recordsIn")

  const { chartData, stats } = useMemo(() => {
    const values = subtasks.map((s) => s[metric])
    const total = values.reduce((a, b) => a + b, 0)
    const avg = values.length > 0 ? total / values.length : 0
    const max = Math.max(...values, 0)
    const min = Math.min(...values, 0)

    return {
      chartData: subtasks.map((s) => ({
        subtask: String(s.subtaskIndex),
        value: s[metric],
      })),
      stats: { total, avg, max, min },
    }
  }, [subtasks, metric])

  return (
    <div className="flex flex-col gap-4">
      {/* Metric selector */}
      <div className="flex flex-wrap gap-1 rounded-md border border-dash-border p-0.5">
        {METRIC_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            type="button"
            onClick={() => setMetric(opt.key)}
            className={cn(
              "rounded px-2.5 py-1 text-[11px] font-medium transition-colors",
              metric === opt.key
                ? "bg-dash-elevated text-zinc-200"
                : "text-zinc-500 hover:text-zinc-300",
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {/* Bar chart */}
      <div className="glass-card p-4">
        <ResponsiveContainer width="100%" height={250}>
          <BarChart
            data={chartData}
            margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
          >
            <XAxis
              dataKey="subtask"
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              label={{
                value: "Subtask Index",
                position: "insideBottom",
                offset: -2,
                style: { fontSize: 10, fill: "var(--color-fg-faint)" },
              }}
            />
            <YAxis
              tick={{ fontSize: 10, fill: "var(--color-fg-faint)" }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatSI}
              width={55}
            />
            <Tooltip
              content={<MetricsChartTooltip />}
              cursor={{ fill: "var(--color-chart-cursor-fill)" }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="value"
              radius={[3, 3, 0, 0]}
              isAnimationActive={false}
            >
              {chartData.map((entry) => (
                <Cell
                  key={entry.subtask}
                  fill="var(--color-fr-purple)"
                  fillOpacity={0.6}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          { label: "Total", value: formatSI(stats.total) },
          { label: "Avg", value: formatSI(stats.avg) },
          { label: "Min", value: formatSI(stats.min) },
          { label: "Max", value: formatSI(stats.max) },
        ].map((s) => (
          <div
            key={s.label}
            className="glass-card flex flex-col items-center gap-0.5 p-2"
          >
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              {s.label}
            </span>
            <span className="text-sm font-medium tabular-nums text-zinc-200">
              {s.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// VerticesTab — main component
// ---------------------------------------------------------------------------

export function VerticesTab({
  job,
  selectedVertexId,
}: {
  job: FlinkJob
  selectedVertexId?: string
}) {
  const vertices = job.plan?.vertices ?? []
  const [vertexId, setVertexId] = useState<string>(
    () => selectedVertexId ?? vertices[0]?.id ?? "",
  )

  // Sync external selection changes
  const [prevSelectedId, setPrevSelectedId] = useState(selectedVertexId)
  if (selectedVertexId !== prevSelectedId) {
    setPrevSelectedId(selectedVertexId)
    if (selectedVertexId) {
      setVertexId(selectedVertexId)
    }
  }

  const vertex = vertices.find((v) => v.id === vertexId)
  const subtasks = job.subtaskMetrics[vertexId] ?? []
  const watermarks = job.watermarks[vertexId] ?? []
  const bp = job.backpressure[vertexId]
  const accumulators = job.accumulators[vertexId] ?? []

  if (vertices.length === 0) {
    return <EmptyState icon={Layers} message="No vertex data available" />
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Vertex selector */}
      <Select value={vertexId} onValueChange={setVertexId}>
        <SelectTrigger className="w-[360px]">
          <SelectValue placeholder="Select vertex" />
        </SelectTrigger>
        <SelectContent>
          {vertices.map((v) => (
            <SelectItem key={v.id} value={v.id}>
              {v.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Sub-tabs */}
      <Tabs defaultValue="detail">
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="detail" className="detail-tab">
            Detail
          </TabsTrigger>
          <TabsTrigger value="subtasks" className="detail-tab">
            SubTasks
          </TabsTrigger>
          <TabsTrigger value="taskmanagers" className="detail-tab">
            TaskManagers
          </TabsTrigger>
          <TabsTrigger value="watermarks" className="detail-tab">
            Watermarks
          </TabsTrigger>
          <TabsTrigger value="backpressure" className="detail-tab">
            BackPressure
          </TabsTrigger>
          <TabsTrigger value="accumulators" className="detail-tab">
            Accumulators
          </TabsTrigger>
          <TabsTrigger value="metrics" className="detail-tab">
            Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="detail" className="mt-4">
          {vertex && <DetailSection vertex={vertex} subtasks={subtasks} />}
        </TabsContent>

        <TabsContent value="subtasks" className="mt-4">
          <SubTasksSection subtasks={subtasks} />
        </TabsContent>

        <TabsContent value="taskmanagers" className="mt-4">
          <TaskManagersSection subtasks={subtasks} />
        </TabsContent>

        <TabsContent value="watermarks" className="mt-4">
          <WatermarksSection watermarks={watermarks} />
        </TabsContent>

        <TabsContent value="backpressure" className="mt-4">
          <BackPressureSection bp={bp} />
        </TabsContent>

        <TabsContent value="accumulators" className="mt-4">
          <AccumulatorsSection accumulators={accumulators} />
        </TabsContent>

        <TabsContent value="metrics" className="mt-4">
          <MetricsSection subtasks={subtasks} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
