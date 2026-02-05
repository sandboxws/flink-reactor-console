"use client";

import {
  Cpu,
  Server,
  Layers,
  Play,
  CheckCircle2,
} from "lucide-react";
import { useClusterStore } from "@/stores/cluster-store";
import { StatCard } from "./stat-card";
import { SlotUtilization } from "./slot-utilization";
import { JobStatusSummary } from "./job-status-summary";
import { ClusterInfo } from "./cluster-info";
import { JobList } from "./job-list";

export function OverviewPage() {
  const overview = useClusterStore((s) => s.overview);
  const runningJobs = useClusterStore((s) => s.runningJobs);
  const completedJobs = useClusterStore((s) => s.completedJobs);

  if (!overview) return null;

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Cluster info bar */}
      <ClusterInfo
        version={overview.flinkVersion}
        commitId={overview.flinkCommitId}
      />

      {/* Top row: key metrics */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          icon={Server}
          label="Active Task Managers"
          value={overview.taskManagerCount}
          accent="text-fr-purple"
        />
        <StatCard
          icon={Layers}
          label="Total Task Slots"
          value={overview.totalTaskSlots}
          accent="text-fr-coral"
        />
        <StatCard
          icon={Cpu}
          label="Available Slots"
          value={overview.availableTaskSlots}
          accent="text-job-running"
        />
      </div>

      {/* Second row: utilization + job status */}
      <div className="grid gap-4 lg:grid-cols-2">
        <SlotUtilization
          available={overview.availableTaskSlots}
          total={overview.totalTaskSlots}
        />
        <JobStatusSummary
          running={overview.runningJobs}
          finished={overview.finishedJobs}
          cancelled={overview.cancelledJobs}
          failed={overview.failedJobs}
        />
      </div>

      {/* Job lists — full width */}
      <JobList
        title="Running Jobs"
        href="/jobs/running"
        icon={Play}
        jobs={runningJobs}
        accent="text-job-running"
      />
      <JobList
        title="Completed Jobs"
        href="/jobs/completed"
        icon={CheckCircle2}
        jobs={completedJobs}
        accent="text-job-finished"
      />
    </div>
  );
}
