import type { ActiveAlert, CheckpointTimelineEntry } from "@flink-reactor/ui"
import {
  AlertCard,
  CheckpointJobTable,
  CheckpointTimelineChart,
  StateSizeChart,
} from "@flink-reactor/ui"
import {
  createCheckpointTimelineEntry,
  createJobCheckpointSummary,
} from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const summary = createJobCheckpointSummary()
const summary2 = createJobCheckpointSummary({
  jobId: "job-002",
  jobName: "analytics-daily-rollup",
  successRate: 97.5,
  totalStateSize: 1_073_741_824,
  durationTrend: "increasing",
  stateSizeTrend: "stable",
})

const timelineEntries: CheckpointTimelineEntry[] = Array.from(
  { length: 20 },
  (_, i) =>
    createCheckpointTimelineEntry({
      timestamp: new Date(Date.now() - (20 - i) * 60_000),
      successes: Math.floor(Math.random() * 5) + 8,
      failures: Math.random() > 0.9 ? 1 : 0,
    }),
)

const sampleAlert: ActiveAlert = {
  id: "alert-001",
  ruleId: "rule-bp-high",
  ruleName: "High Backpressure",
  severity: "warning",
  message:
    "Vertex 'Aggregate: SUM(amount)' backpressure ratio exceeds 0.6 for 5 minutes",
  currentValue: 0.72,
  threshold: 0.6,
  triggeredAt: new Date(Date.now() - 300_000),
  acknowledged: false,
}

const criticalAlert: ActiveAlert = {
  id: "alert-002",
  ruleId: "rule-cp-fail",
  ruleName: "Checkpoint Failures",
  severity: "critical",
  message: "Job 'analytics-daily-rollup' has 3 consecutive checkpoint failures",
  currentValue: 3,
  threshold: 2,
  triggeredAt: new Date(Date.now() - 120_000),
  acknowledged: false,
}

const alertCardProps: PropDef[] = [
  {
    name: "alert",
    type: "ActiveAlert",
    description:
      "Alert object with severity, rule name, message, current/threshold values",
  },
  {
    name: "onAcknowledge",
    type: "(id: string) => void",
    description: "Callback to acknowledge the alert",
  },
  {
    name: "onResolve",
    type: "(id: string) => void",
    description: "Callback to resolve/dismiss the alert",
  },
]

const checkpointTimelineChartProps: PropDef[] = [
  {
    name: "timeline",
    type: "CheckpointTimelineEntry[]",
    description:
      "Array of timeline entries with timestamp, success and failure counts",
  },
]

const stateSizeChartProps: PropDef[] = [
  {
    name: "summaries",
    type: "JobCheckpointSummary[]",
    description:
      "Checkpoint summaries per job, used to plot state size or duration trends",
  },
]

const checkpointJobTableProps: PropDef[] = [
  {
    name: "summaries",
    type: "JobCheckpointSummary[]",
    description: "Per-job checkpoint summary rows with sort, trend indicators",
  },
]

const TOC = [
  { id: "alert-card", label: "AlertCard" },
  { id: "checkpoint-timeline-chart", label: "CheckpointTimelineChart" },
  { id: "state-size-chart", label: "StateSizeChart" },
  { id: "checkpoint-job-table", label: "CheckpointJobTable" },
]

function MonitoringDomainPage() {
  return (
    <ShowcasePage
      title="Monitoring"
      description="Alerts and checkpoint monitoring. 4 components."
      items={TOC}
    >
      <Section
        id="alert-card"
        title="AlertCard"
        description="Alert card with severity icon, metric values, acknowledge and resolve actions."
      >
        <div className="flex flex-col gap-3 max-w-2xl">
          <AlertCard
            alert={sampleAlert}
            onAcknowledge={(_id) => {}}
            onResolve={(_id) => {}}
          />
          <AlertCard
            alert={criticalAlert}
            onAcknowledge={(_id) => {}}
            onResolve={(_id) => {}}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={alertCardProps} />
        </div>
      </Section>

      <Section
        id="checkpoint-timeline-chart"
        title="CheckpointTimelineChart"
        description="Stacked bar chart of checkpoint successes and failures over time."
      >
        <CheckpointTimelineChart timeline={timelineEntries} />
        <div className="mt-4">
          <PropsTable props={checkpointTimelineChartProps} />
        </div>
      </Section>

      <Section
        id="state-size-chart"
        title="StateSizeChart"
        description="Area chart (state size) or line chart (duration) togglable per job, with per-job color coding."
      >
        <StateSizeChart summaries={[summary, summary2]} />
        <div className="mt-4">
          <PropsTable props={stateSizeChartProps} />
        </div>
      </Section>

      <Section
        id="checkpoint-job-table"
        title="CheckpointJobTable"
        description="Sortable table of per-job checkpoint statistics with trend indicators."
      >
        <CheckpointJobTable summaries={[summary, summary2]} />
        <div className="mt-4">
          <PropsTable props={checkpointJobTableProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/monitoring")({
  component: MonitoringDomainPage,
})
