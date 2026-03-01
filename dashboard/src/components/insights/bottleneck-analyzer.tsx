"use client";

import { AlertTriangle, BarChart3, Layers, Search } from "lucide-react";
import { MetricCard } from "@/components/shared/metric-card";
import { useClusterStore } from "@/stores/cluster-store";
import { useInsightsStore } from "@/stores/insights-store";
import { BottleneckDAG } from "./bottleneck-dag";
import { BottleneckTable } from "./bottleneck-table";
import { RecommendationsPanel } from "./recommendations-panel";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="h-8 w-56 animate-pulse rounded bg-zinc-800" />
      <div className="grid gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card h-24 animate-pulse" />
        ))}
      </div>
      <div className="glass-card h-[400px] animate-pulse" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card h-[300px] animate-pulse" />
        <div className="glass-card h-[300px] animate-pulse" />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100">
        Bottleneck Analyzer
      </h1>
      <div className="glass-card flex flex-col items-center justify-center gap-3 py-16">
        <Search className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-400">No running jobs to analyze</p>
        <p className="text-xs text-zinc-600">
          Bottleneck analysis requires at least one running job with vertex data
        </p>
      </div>
    </div>
  );
}

export function BottleneckAnalyzerPage() {
  const runningJobs = useClusterStore((s) => s.runningJobs);
  const bottleneckScores = useInsightsStore((s) => s.bottleneckScores);
  const recommendations = useInsightsStore((s) => s.recommendations);
  const selectedJobId = useInsightsStore((s) => s.selectedBottleneckJobId);
  const setSelectedJob = useInsightsStore((s) => s.setSelectedBottleneckJob);
  const bottleneckLoading = useInsightsStore((s) => s.bottleneckLoading);

  if (bottleneckLoading && bottleneckScores.length === 0) {
    return <LoadingSkeleton />;
  }

  if (runningJobs.length === 0) {
    return <EmptyState />;
  }

  // Summary metrics
  const worstScore = bottleneckScores.length > 0
    ? Math.max(...bottleneckScores.map((s) => s.score))
    : 0;
  const jobsWithIssues = new Set(
    bottleneckScores.filter((s) => s.severity !== "low").map((s) => s.jobId),
  ).size;

  // Collect edges from all analyzed jobs (for DAG)
  const selectedJob = selectedJobId
    ? runningJobs.find((j) => j.id === selectedJobId)
    : null;
  const edges = selectedJob?.plan?.edges ?? (
    selectedJobId === null
      ? runningJobs.flatMap((j) => j.plan?.edges ?? [])
      : []
  );

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header + job selector */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">
          Bottleneck Analyzer
        </h1>
        <select
          value={selectedJobId ?? ""}
          onChange={(e) =>
            setSelectedJob(e.target.value === "" ? null : e.target.value)
          }
          className="rounded-md border border-dash-border bg-dash-panel px-3 py-1.5 text-xs text-zinc-300 outline-none transition-colors hover:bg-dash-hover focus:border-zinc-500"
        >
          <option value="">All Jobs</option>
          {runningJobs.map((job) => (
            <option key={job.id} value={job.id}>
              {job.name}
            </option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <MetricCard
          icon={AlertTriangle}
          label="Worst Score"
          value={worstScore}
          accent={
            worstScore > 60
              ? "text-job-failed"
              : worstScore > 30
                ? "text-fr-amber"
                : "text-job-running"
          }
        />
        <MetricCard
          icon={Layers}
          label="Jobs with Issues"
          value={jobsWithIssues}
          accent={jobsWithIssues > 0 ? "text-fr-amber" : "text-job-running"}
        />
        <MetricCard
          icon={BarChart3}
          label="Vertices Analyzed"
          value={bottleneckScores.length}
          accent="text-fr-purple"
        />
      </div>

      {/* DAG visualization */}
      <BottleneckDAG scores={bottleneckScores} edges={edges} />

      {/* Table + Recommendations */}
      <div className="grid gap-4 lg:grid-cols-2">
        <BottleneckTable scores={bottleneckScores} />
        <RecommendationsPanel recommendations={recommendations} />
      </div>
    </div>
  );
}
