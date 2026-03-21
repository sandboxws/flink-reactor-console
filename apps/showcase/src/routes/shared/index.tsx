import { createFileRoute } from "@tanstack/react-router"
import {
  MetricCard,
  EmptyState,
  SeverityBadge,
  SourceBadge,
  JobStatusBadge,
  MemoryBar,
  DurationCell,
  HealthScoreGauge,
} from "@flink-reactor/ui"
import { Activity, Cpu, Database, Gauge } from "lucide-react"

function SharedPage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold text-fg">Shared Components</h1>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">MetricCard</h2>
        <div className="grid grid-cols-2 gap-4 max-w-lg">
          <MetricCard icon={Activity} label="Running Jobs" value="3" accent="var(--color-job-running)" />
          <MetricCard icon={Cpu} label="Task Managers" value="4" accent="var(--color-fr-coral)" />
          <MetricCard icon={Database} label="Total Slots" value="16" accent="var(--color-fr-purple)" />
          <MetricCard icon={Gauge} label="Available" value="4" accent="var(--color-fr-amber)" />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">SeverityBadge</h2>
        <div className="flex flex-wrap gap-2">
          {(["TRACE", "DEBUG", "INFO", "WARN", "ERROR"] as const).map((level) => (
            <SeverityBadge key={level} level={level} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">SourceBadge</h2>
        <div className="flex flex-wrap gap-2">
          <SourceBadge source={{ type: "jobmanager", id: "jm-1", label: "JM" }} />
          <SourceBadge source={{ type: "taskmanager", id: "tm-0", label: "TM-0" }} />
          <SourceBadge source={{ type: "taskmanager", id: "tm-1", label: "TM-1" }} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">JobStatusBadge</h2>
        <div className="flex flex-wrap gap-2">
          {(["RUNNING", "FINISHED", "FAILED", "CANCELED", "CREATED"] as const).map((s) => (
            <JobStatusBadge key={s} status={s} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">MemoryBar</h2>
        <div className="flex flex-col gap-3 max-w-sm">
          <MemoryBar used={1_500_000_000} total={4_294_967_296} />
          <MemoryBar used={3_500_000_000} total={4_294_967_296} />
          <MemoryBar used={4_000_000_000} total={4_294_967_296} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">DurationCell</h2>
        <div className="flex flex-col gap-2">
          <DurationCell startTime={new Date(Date.now() - 3_600_000)} endTime={null} isRunning={true} />
          <DurationCell startTime={new Date(Date.now() - 7_200_000)} endTime={new Date(Date.now() - 3_600_000)} isRunning={false} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">HealthScoreGauge</h2>
        <div className="flex gap-6">
          <HealthScoreGauge score={92} />
          <HealthScoreGauge score={65} />
          <HealthScoreGauge score={35} />
        </div>
      </section>

      <section>
        <h2 className="text-lg font-medium text-fg mb-4">EmptyState</h2>
        <EmptyState />
      </section>
    </div>
  )
}

export const Route = createFileRoute("/shared/")({
  component: SharedPage,
})
