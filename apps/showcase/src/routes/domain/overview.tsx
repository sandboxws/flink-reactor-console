import {
  ClusterInfo,
  JobStatusSummary,
  SlotUtilization,
  StatCard,
} from "@flink-reactor/ui"
import { createClusterOverview } from "@flink-reactor/ui/fixtures"
import { createFileRoute } from "@tanstack/react-router"
import { Activity, Cpu, Layers, Server } from "lucide-react"
import { type PropDef, PropsTable } from "@/lib/props-table"
import { Section, ShowcasePage } from "@/lib/section"

const overview = createClusterOverview()

const statCardProps: PropDef[] = [
  {
    name: "icon",
    type: "React.ComponentType<{ className?: string }>",
    description: "Lucide icon or similar component rendered at card top",
  },
  {
    name: "label",
    type: "string",
    description: "Metric label displayed below the icon",
  },
  {
    name: "value",
    type: "React.ReactNode",
    description: "Primary metric value",
  },
  {
    name: "accent",
    type: "string",
    default: "undefined",
    description: "Tailwind color class for accent styling",
  },
]

const clusterInfoProps: PropDef[] = [
  { name: "version", type: "string", description: "Flink version string" },
  {
    name: "commitId",
    type: "string",
    description: "Git commit hash (first 7 chars displayed)",
  },
  {
    name: "capabilities",
    type: "string[]",
    default: "undefined",
    description: "Optional feature capability badges",
  },
]

const slotUtilizationProps: PropDef[] = [
  {
    name: "available",
    type: "number",
    description: "Number of available task slots",
  },
  { name: "total", type: "number", description: "Total number of task slots" },
]

const jobStatusSummaryProps: PropDef[] = [
  { name: "running", type: "number", description: "Count of running jobs" },
  { name: "finished", type: "number", description: "Count of finished jobs" },
  { name: "cancelled", type: "number", description: "Count of cancelled jobs" },
  { name: "failed", type: "number", description: "Count of failed jobs" },
]

const TOC = [
  { id: "stat-card", label: "StatCard" },
  { id: "cluster-info", label: "ClusterInfo" },
  { id: "slot-utilization", label: "SlotUtilization" },
  { id: "job-status-summary", label: "JobStatusSummary" },
]

function OverviewDomainPage() {
  return (
    <ShowcasePage
      title="Overview"
      description="Cluster stats and status at a glance. 4 components."
      items={TOC}
    >
      <Section
        id="stat-card"
        title="StatCard"
        description="Glass-effect metric card with icon, label, and accent color."
      >
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard
            icon={Activity}
            label="Running Jobs"
            value={String(overview.runningJobs)}
            accent="text-job-running"
          />
          <StatCard
            icon={Server}
            label="Task Managers"
            value={String(overview.taskManagerCount)}
            accent="text-fr-purple"
          />
          <StatCard
            icon={Cpu}
            label="Total Slots"
            value={String(overview.totalTaskSlots)}
            accent="text-fr-coral"
          />
          <StatCard
            icon={Layers}
            label="Available Slots"
            value={String(overview.availableTaskSlots)}
            accent="text-fr-amber"
          />
        </div>
        <div className="mt-4">
          <PropsTable props={statCardProps} />
        </div>
      </Section>

      <Section
        id="cluster-info"
        title="ClusterInfo"
        description="Compact info bar showing Flink version, commit ID, and capabilities."
      >
        <ClusterInfo
          version={overview.flinkVersion}
          commitId={overview.flinkCommitId}
          capabilities={overview.capabilities}
        />
        <div className="mt-4">
          <PropsTable props={clusterInfoProps} />
        </div>
      </Section>

      <Section
        id="slot-utilization"
        title="SlotUtilization"
        description="Card with progress bar showing slot availability percentage."
      >
        <div className="max-w-sm">
          <SlotUtilization
            total={overview.totalTaskSlots}
            available={overview.availableTaskSlots}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={slotUtilizationProps} />
        </div>
      </Section>

      <Section
        id="job-status-summary"
        title="JobStatusSummary"
        description="Four-panel status grid showing job counts by state with icons."
      >
        <div className="max-w-lg">
          <JobStatusSummary
            running={overview.runningJobs}
            finished={overview.finishedJobs}
            cancelled={overview.cancelledJobs}
            failed={overview.failedJobs}
          />
        </div>
        <div className="mt-4">
          <PropsTable props={jobStatusSummaryProps} />
        </div>
      </Section>
    </ShowcasePage>
  )
}

export const Route = createFileRoute("/domain/overview")({
  component: OverviewDomainPage,
})
