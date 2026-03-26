import type {
  MetricDataPoint,
  MetricMeta,
  TaskCounts,
  TimeRangeValue,
} from "@flink-reactor/ui"
import {
  DurationCell,
  EmptyState,
  getChartColor,
  HealthScoreGauge,
  JobStatusBadge,
  MemoryBar,
  MetricCard,
  MetricChart,
  QueryResults,
  SearchInput,
  SeverityBadge,
  SourceBadge,
  StackTrace,
  TaskCountsBar,
  TextViewer,
  TimeRange,
} from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Activity, Cpu, Database, Gauge } from "lucide-react"
import { useState } from "react"
import { ImportSnippet } from "@/lib/code-sample"
import { PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

// ---------------------------------------------------------------------------
// Table of Contents items
// ---------------------------------------------------------------------------

const tocItems = [
  { id: "metric-card", label: "MetricCard" },
  { id: "severity-badge", label: "SeverityBadge" },
  { id: "source-badge", label: "SourceBadge" },
  { id: "job-status-badge", label: "JobStatusBadge" },
  { id: "memory-bar", label: "MemoryBar" },
  { id: "duration-cell", label: "DurationCell" },
  { id: "health-score-gauge", label: "HealthScoreGauge" },
  { id: "empty-state", label: "EmptyState" },
  { id: "text-viewer", label: "TextViewer" },
  { id: "search-input", label: "SearchInput" },
  { id: "time-range", label: "TimeRange" },
  { id: "query-results", label: "QueryResults" },
  { id: "stack-trace", label: "StackTrace" },
  { id: "task-counts-bar", label: "TaskCountsBar" },
  { id: "metric-chart", label: "MetricChart" },
]

// ---------------------------------------------------------------------------
// Demo data
// ---------------------------------------------------------------------------

const sampleLogText = `2026-03-21 08:12:01,234 INFO  org.apache.flink.runtime.jobmaster.JobMaster  - Starting execution of job 'WordCount' (a]1b2c3d4e5f6a7b8).
2026-03-21 08:12:01,456 INFO  org.apache.flink.runtime.executiongraph.ExecutionGraph  - Job WordCount (a1b2c3d4e5f6a7b8) switched from state CREATED to RUNNING.
2026-03-21 08:12:01,789 DEBUG org.apache.flink.runtime.taskmanager.Task  - Source: Custom Source (1/4) switched from DEPLOYING to RUNNING.
2026-03-21 08:12:02,012 INFO  org.apache.flink.runtime.taskmanager.Task  - Flat Map (1/4) switched from DEPLOYING to RUNNING.
2026-03-21 08:12:02,345 WARN  org.apache.flink.runtime.checkpoint.CheckpointCoordinator  - Checkpoint 7 expired before completing. Increasing checkpoint interval or timeout may help.
2026-03-21 08:12:03,678 ERROR org.apache.flink.runtime.taskmanager.Task  - Flat Map (3/4) threw exception: java.lang.OutOfMemoryError: Java heap space
2026-03-21 08:12:03,901 INFO  org.apache.flink.runtime.checkpoint.CheckpointCoordinator  - Triggering checkpoint 8 (type=CHECKPOINT) @ 1711008723901.
2026-03-21 08:12:04,123 DEBUG org.apache.flink.runtime.io.network.partition.consumer.SingleInputGate  - Requesting subpartitions for gate with id a1b2c3d.
2026-03-21 08:12:04,456 INFO  org.apache.flink.runtime.checkpoint.CheckpointCoordinator  - Completed checkpoint 8 for job a1b2c3d4e5f6a7b8 (12345 bytes in 234 ms).
2026-03-21 08:12:05,789 WARN  org.apache.flink.runtime.taskmanager.Task  - Source: Custom Source (2/4) - high backpressure detected.`

const sampleStackTrace = `java.lang.OutOfMemoryError: Java heap space
\tat java.base/java.util.Arrays.copyOf(Arrays.java:3536)
\tat java.base/java.util.ArrayList.grow(ArrayList.java:265)
\tat java.base/java.util.ArrayList.add(ArrayList.java:462)
\tat com.example.pipeline.WordCountMapper.flatMap(WordCountMapper.java:42)
\tat com.example.pipeline.WordCountMapper.flatMap(WordCountMapper.java:28)
\tat org.apache.flink.streaming.api.operators.StreamFlatMap.processElement(StreamFlatMap.java:50)
\tat org.apache.flink.streaming.runtime.tasks.CopyingChainingOutput.pushToOperator(CopyingChainingOutput.java:71)
\tat org.apache.flink.streaming.runtime.tasks.CopyingChainingOutput.collect(CopyingChainingOutput.java:46)
\tat org.apache.flink.streaming.api.operators.StreamSourceContexts$ManualWatermarkContext.processAndCollectWithTimestamp(StreamSourceContexts.java:418)
\tat org.apache.flink.streaming.api.operators.StreamSourceContexts$WatermarkContext.collect(StreamSourceContexts.java:513)
\tat com.example.pipeline.CustomSource.run(CustomSource.java:67)
\tat org.apache.flink.streaming.api.operators.StreamSource.run(StreamSource.java:110)
\tat org.apache.flink.streaming.api.operators.StreamSource.run(StreamSource.java:66)
\tat org.apache.flink.streaming.runtime.tasks.SourceStreamTask$LegacySourceFunctionThread.run(SourceStreamTask.java:333)`

const sampleQueryColumns = [
  { name: "id", dataType: "BIGINT" },
  { name: "name", dataType: "VARCHAR" },
  { name: "status", dataType: "VARCHAR" },
  { name: "count", dataType: "INT" },
]

const sampleQueryRows: (Record<string, unknown> | null)[][] = [
  [
    { id: 1 },
    { name: "word-count-job" },
    { status: "RUNNING" },
    { count: 1842 },
  ],
  [
    { id: 2 },
    { name: "click-analytics" },
    { status: "RUNNING" },
    { count: 5391 },
  ],
  [
    { id: 3 },
    { name: "fraud-detection" },
    { status: "FINISHED" },
    { count: 12004 },
  ],
  [{ id: 4 }, { name: "etl-pipeline" }, { status: "FAILED" }, { count: 903 }],
  [{ id: 5 }, { name: "session-window" }, { status: "CANCELED" }, { count: 0 }],
]

const sampleTaskCounts: TaskCounts = {
  pending: 3,
  running: 6,
  finished: 2,
  canceling: 0,
  failed: 1,
}

const sampleMetricData: MetricDataPoint[] = Array.from(
  { length: 20 },
  (_, i) => ({
    timestamp: Date.now() - (20 - i) * 60000,
    value: 50 + Math.random() * 30,
  }),
)

const sampleMetricMeta: MetricMeta = { type: "gauge", unit: "records/s" }

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

/** Showcase route: /shared -- Shared components showcase with metric cards, badges, log viewers, charts, and data display widgets. */
function SharedPage() {
  const [searchValue, setSearchValue] = useState("checkpoint")
  const [searchRegex, setSearchRegex] = useState(false)
  const [timeRange, setTimeRange] = useState<TimeRangeValue>({})

  return (
    <ShowcasePage
      title="Shared Components"
      description="Domain-specific components for Flink dashboards — metrics, badges, log viewers, and data display."
      items={tocItems}
    >
      <ImportSnippet
        code={`import {
  MetricCard, SeverityBadge, SourceBadge, JobStatusBadge,
  MemoryBar, DurationCell, HealthScoreGauge, EmptyState,
  TextViewer, SearchInput, TimeRange, QueryResults,
  StackTrace, TaskCountsBar, MetricChart,
} from "@flink-reactor/ui"`}
      />

      {/* ── 1. MetricCard ─────────────────────────────────────────────────── */}
      <Section
        id="metric-card"
        title="MetricCard"
        description="Glass-effect card displaying a single metric with icon and accent color."
      >
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <MetricCard
            icon={Activity}
            label="Running Jobs"
            value="3"
            accent="var(--color-job-running)"
          />
          <MetricCard
            icon={Cpu}
            label="Task Managers"
            value="4"
            accent="var(--color-fr-coral)"
          />
          <MetricCard
            icon={Database}
            label="Total Slots"
            value="16"
            accent="var(--color-fr-purple)"
          />
          <MetricCard
            icon={Gauge}
            label="Available"
            value="4"
            accent="var(--color-fr-amber)"
          />
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "icon",
                type: "LucideIcon",
                description: "Icon component from lucide-react",
              },
              {
                name: "label",
                type: "string",
                description: "Metric label text",
              },
              {
                name: "value",
                type: "string",
                description: "Formatted metric value",
              },
              {
                name: "accent",
                type: "string",
                description: "CSS color for the accent bar",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 2. SeverityBadge ──────────────────────────────────────────────── */}
      <Section
        id="severity-badge"
        title="SeverityBadge"
        description="Colored badge for log severity levels."
      >
        <div className="flex flex-wrap gap-2">
          {(["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const).map(
            (level) => (
              <SeverityBadge key={level} level={level} />
            ),
          )}
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "level",
                type: '"TRACE" | "DEBUG" | "INFO" | "WARN" | "ERROR"',
                description: "Log severity level",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 3. SourceBadge ────────────────────────────────────────────────── */}
      <Section
        id="source-badge"
        title="SourceBadge"
        description="Badge showing the log source (JobManager or TaskManager)."
      >
        <div className="flex flex-wrap gap-2">
          <SourceBadge
            source={{ type: "jobmanager", id: "jm-1", label: "JM" }}
          />
          <SourceBadge
            source={{ type: "taskmanager", id: "tm-0", label: "TM-0" }}
          />
          <SourceBadge
            source={{ type: "taskmanager", id: "tm-1", label: "TM-1" }}
          />
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "source",
                type: "LogSource",
                description:
                  'Object with type ("jobmanager" | "taskmanager"), id, and label',
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 4. JobStatusBadge ─────────────────────────────────────────────── */}
      <Section
        id="job-status-badge"
        title="JobStatusBadge"
        description="Colored badge for Flink job states."
      >
        <div className="flex flex-wrap gap-2">
          {(
            ["RUNNING", "FINISHED", "FAILED", "CANCELED", "CREATED"] as const
          ).map((s) => (
            <JobStatusBadge key={s} status={s} />
          ))}
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "status",
                type: '"RUNNING" | "FINISHED" | "FAILED" | "CANCELED" | "CREATED"',
                description: "Flink job status",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 5. MemoryBar ──────────────────────────────────────────────────── */}
      <Section
        id="memory-bar"
        title="MemoryBar"
        description="Progress bar showing memory utilization with formatted labels."
      >
        <div className="flex flex-col gap-3 max-w-sm">
          <MemoryBar used={1_500_000_000} total={4_294_967_296} />
          <MemoryBar used={3_500_000_000} total={4_294_967_296} />
          <MemoryBar used={4_000_000_000} total={4_294_967_296} />
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "used",
                type: "number",
                description: "Used memory in bytes",
              },
              {
                name: "total",
                type: "number",
                description: "Total memory in bytes",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 6. DurationCell ───────────────────────────────────────────────── */}
      <Section
        id="duration-cell"
        title="DurationCell"
        description="Displays elapsed duration with live-updating support for running jobs."
      >
        <div className="flex flex-col gap-2">
          <DurationCell
            startTime={new Date(Date.now() - 3_600_000)}
            endTime={null}
            isRunning={true}
          />
          <DurationCell
            startTime={new Date(Date.now() - 7_200_000)}
            endTime={new Date(Date.now() - 3_600_000)}
            isRunning={false}
          />
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "startTime",
                type: "Date",
                description: "Job start timestamp",
              },
              {
                name: "endTime",
                type: "Date | null",
                description: "Job end timestamp (null if still running)",
              },
              {
                name: "isRunning",
                type: "boolean",
                description:
                  "Whether the job is currently running (enables live updates)",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 7. HealthScoreGauge ───────────────────────────────────────────── */}
      <Section
        id="health-score-gauge"
        title="HealthScoreGauge"
        description="Circular gauge displaying a health score from 0-100."
      >
        <div className="flex gap-6">
          <HealthScoreGauge score={92} />
          <HealthScoreGauge score={65} />
          <HealthScoreGauge score={35} />
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "score",
                type: "number",
                description:
                  "Health score value (0-100). Color shifts from red to amber to green.",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 8. EmptyState ─────────────────────────────────────────────────── */}
      <Section
        id="empty-state"
        title="EmptyState"
        description="Centered placeholder for empty content areas."
      >
        <EmptyState />
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "icon",
                type: "LucideIcon",
                default: "Inbox",
                description: "Icon to display",
              },
              {
                name: "message",
                type: "string",
                default: '"No data to display"',
                description: "Message text",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 9. TextViewer ─────────────────────────────────────────────────── */}
      <Section
        id="text-viewer"
        title="TextViewer"
        description="Readonly monospace text pane with line numbers and copy button. Ideal for logs and config files."
      >
        <TextViewer text={sampleLogText} maxHeight="280px" />
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "text",
                type: "string",
                description: "The text content to display",
              },
              {
                name: "maxHeight",
                type: "string",
                default: '"480px"',
                description: "CSS max-height for the container",
              },
              {
                name: "showLineNumbers",
                type: "boolean",
                default: "true",
                description: "Whether to show line numbers",
              },
              {
                name: "showCopyButton",
                type: "boolean",
                default: "true",
                description: "Whether to show the copy-to-clipboard button",
              },
              {
                name: "className",
                type: "string",
                description: "Additional CSS classes",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 10. SearchInput ───────────────────────────────────────────────── */}
      <Section
        id="search-input"
        title="SearchInput"
        description="Search box with regex toggle and match navigation for log/text search."
      >
        <div className="max-w-md">
          <SearchInput
            value={searchValue}
            onChange={setSearchValue}
            isRegex={searchRegex}
            onRegexChange={setSearchRegex}
            matchCount={3}
            currentIndex={0}
            placeholder="Search logs..."
          />
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          Current value: <code className="text-fr-purple">{searchValue}</code>
          {" | "}Regex:{" "}
          <code className="text-fr-purple">{String(searchRegex)}</code>
        </p>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "value",
                type: "string",
                description: "Current search query",
              },
              {
                name: "onChange",
                type: "(value: string) => void",
                description: "Called when the search query changes",
              },
              {
                name: "isRegex",
                type: "boolean",
                default: "false",
                description: "Whether regex mode is enabled",
              },
              {
                name: "onRegexChange",
                type: "(isRegex: boolean) => void",
                description: "Called when regex mode is toggled",
              },
              {
                name: "matchCount",
                type: "number",
                description: "Current match count",
              },
              {
                name: "currentIndex",
                type: "number",
                default: "0",
                description: "Current match index (0-based)",
              },
              {
                name: "onNext",
                type: "() => void",
                description: "Called when navigating to next match",
              },
              {
                name: "onPrev",
                type: "() => void",
                description: "Called when navigating to previous match",
              },
              {
                name: "placeholder",
                type: "string",
                default: '"Search..."',
                description: "Placeholder text",
              },
              {
                name: "className",
                type: "string",
                description: "Additional CSS classes",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 11. TimeRange ─────────────────────────────────────────────────── */}
      <Section
        id="time-range"
        title="TimeRange"
        description="Quick-select time range buttons for filtering logs and metrics data. Two variants: mini (compact toolbar widget) and full (standalone filter bar with coral accent)."
      >
        <div className="flex flex-col gap-4 mb-4">
          <div>
            <p className="mb-2 text-xs font-medium text-fg-dim">mini (default)</p>
            <TimeRange value={timeRange} onChange={setTimeRange} />
          </div>
          <div>
            <p className="mb-2 text-xs font-medium text-fg-dim">full</p>
            <TimeRange
              value={timeRange}
              onChange={setTimeRange}
              variant="full"
              presets={[
                { label: "1 Hour", minutes: 60 },
                { label: "2 Hours", minutes: 120 },
                { label: "24 Hours", minutes: 1440 },
                { label: "7 Days", minutes: 10080 },
                { label: "30 Days", minutes: 43200 },
              ]}
            />
          </div>
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          Range:{" "}
          <code className="text-fr-purple">
            {timeRange.start
              ? `${timeRange.start.toLocaleTimeString()} - ${timeRange.end?.toLocaleTimeString() ?? "now"}`
              : "All"}
          </code>
        </p>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "value",
                type: "TimeRangeValue",
                description:
                  "Current time range value ({ start?: Date; end?: Date })",
              },
              {
                name: "onChange",
                type: "(value: TimeRangeValue) => void",
                description: "Called when a preset is selected",
              },
              {
                name: "variant",
                type: '"mini" | "full"',
                default: '"mini"',
                description:
                  "Visual variant — mini for compact toolbars, full for standalone filter bars",
              },
              {
                name: "presets",
                type: "TimeRangePreset[]",
                default: "5m, 15m, 1h, 6h, 24h, All",
                description: "Custom preset options",
              },
              {
                name: "className",
                type: "string",
                description: "Additional CSS classes",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 12. QueryResults ──────────────────────────────────────────────── */}
      <Section
        id="query-results"
        title="QueryResults"
        description="Table display for SQL query results with status bar and row counts."
      >
        <QueryResults
          columns={sampleQueryColumns}
          rows={sampleQueryRows}
          rowCount={sampleQueryRows.length}
          executionTimeMs={142}
        />
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "columns",
                type: "{ name: string; dataType: string }[]",
                description: "Column definitions with name and SQL data type",
              },
              {
                name: "rows",
                type: "(Record<string, unknown> | null)[][]",
                description: "Row data as an array of cell arrays",
              },
              {
                name: "rowCount",
                type: "number",
                description: "Total row count displayed in the status bar",
              },
              {
                name: "executionTimeMs",
                type: "number",
                description: "Query execution time in milliseconds",
              },
              {
                name: "truncated",
                type: "boolean",
                description: "Whether the result set was truncated",
              },
              {
                name: "streaming",
                type: "boolean",
                description: "Whether results are still streaming in",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 13. StackTrace ────────────────────────────────────────────────── */}
      <Section
        id="stack-trace"
        title="StackTrace"
        description="Collapsible Java stack trace viewer that highlights application frames vs framework frames."
      >
        <StackTrace raw={sampleStackTrace} />
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "raw",
                type: "string",
                description:
                  "Raw stack trace text. Framework frames (java.*, org.apache.flink.*) are collapsible.",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 14. TaskCountsBar ─────────────────────────────────────────────── */}
      <Section
        id="task-counts-bar"
        title="TaskCountsBar"
        description="Segmented bar showing task status distribution with tooltip breakdown."
      >
        <div className="flex items-center gap-4">
          <TaskCountsBar tasks={sampleTaskCounts} />
        </div>
        <p className="mt-2 text-xs text-fg-muted">
          Hover over the bar to see the tooltip breakdown.
        </p>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "tasks",
                type: "TaskCounts",
                description:
                  "Record of task status counts: { pending, running, finished, canceling, failed }",
              },
            ]}
          />
        </div>
      </Section>

      {/* ── 15. MetricChart ───────────────────────────────────────────────── */}
      <Section
        id="metric-chart"
        title="MetricChart"
        description="Time-series line chart for streaming metrics with min/max footer and removable header."
      >
        <div className="max-w-lg">
          <MetricChart
            data={sampleMetricData}
            meta={sampleMetricMeta}
            label="flink.taskmanager.Status.JVM.Memory.Heap.Used"
            sourceBadge="TM-0"
            color={getChartColor(0)}
            onRemove={() => {}}
          />
        </div>
        <div className="mt-6">
          <PropsTable
            props={[
              {
                name: "data",
                type: "MetricDataPoint[]",
                description:
                  "Array of { timestamp: number; value: number } points",
              },
              {
                name: "meta",
                type: "MetricMeta",
                description:
                  'Metric metadata: { type: "gauge" | "counter" | "meter"; unit: MetricUnit }',
              },
              {
                name: "label",
                type: "string",
                description:
                  "Full metric name (last two segments shown in header)",
              },
              {
                name: "sourceBadge",
                type: "string",
                description: "Source label badge text (e.g. TM-0, JM)",
              },
              {
                name: "color",
                type: "string",
                description:
                  "Line color (hex). Use getChartColor(index) for palette.",
              },
              {
                name: "onRemove",
                type: "() => void",
                description: "Called when the remove button is clicked",
              },
            ]}
          />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/shared/")({
  component: SharedPage,
})
