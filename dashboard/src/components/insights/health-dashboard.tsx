"use client";

import { useInsightsStore } from "@/stores/insights-store";
import { HealthScoreGauge } from "./health-score-gauge";
import { HealthTrendChart } from "./health-trend-chart";
import { SubScoreGrid } from "./sub-score-grid";
import { TopIssuesList } from "./top-issues-list";

function LoadingSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="h-8 w-48 animate-pulse rounded bg-zinc-800" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card flex h-[260px] items-center justify-center">
          <div className="size-[200px] animate-pulse rounded-full border-[12px] border-zinc-800" />
        </div>
        <div className="glass-card h-[260px] animate-pulse" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {["slots", "backpressure", "checkpoints", "memory", "exceptions"].map(
          (name) => (
            <div key={name} className="glass-card h-24 animate-pulse" />
          ),
        )}
      </div>
      <div className="glass-card h-48 animate-pulse" />
    </div>
  );
}

export function HealthDashboard() {
  const currentHealth = useInsightsStore((s) => s.currentHealth);
  const healthHistory = useInsightsStore((s) => s.healthHistory);
  const issues = useInsightsStore((s) => s.issues);
  const healthLoading = useInsightsStore((s) => s.healthLoading);

  if (healthLoading && !currentHealth) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-lg font-semibold text-zinc-100">Cluster Health</h1>

      {/* Top row: Gauge + Trend chart */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass-card flex items-center justify-center p-6">
          <HealthScoreGauge score={currentHealth?.score ?? 0} />
        </div>
        <HealthTrendChart history={healthHistory} />
      </div>

      {/* Sub-score grid */}
      {currentHealth && <SubScoreGrid subScores={currentHealth.subScores} />}

      {/* Issues list */}
      <TopIssuesList issues={issues} />
    </div>
  );
}
