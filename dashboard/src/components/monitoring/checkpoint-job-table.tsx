"use client";

import { useState } from "react";
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  JobCheckpointSummary,
  TrendDirection,
} from "@/stores/checkpoint-analytics-store";

// Helpers

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatInterval(ms: number): string {
  if (ms >= 60_000) return `${ms / 60_000}min`;
  return `${ms / 1000}s`;
}

function formatTime(date: Date | null): string {
  if (!date) return "—";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

// Trend indicator

function TrendIndicator({ trend }: { trend: TrendDirection }) {
  if (trend === "increasing") {
    return <ArrowUp className="size-3.5 text-job-failed" />;
  }
  if (trend === "decreasing") {
    return <ArrowDown className="size-3.5 text-job-running" />;
  }
  return <ArrowRight className="size-3.5 text-zinc-500" />;
}

// Sort

type SortKey =
  | "jobName"
  | "lastSuccessTime"
  | "checkpointInterval"
  | "avgDuration"
  | "totalStateSize"
  | "successRate"
  | "durationTrend"
  | "stateSizeTrend";

type SortDir = "asc" | "desc";

const TREND_ORDER: Record<TrendDirection, number> = {
  increasing: 2,
  stable: 1,
  decreasing: 0,
};

function sortSummaries(
  summaries: JobCheckpointSummary[],
  key: SortKey,
  dir: SortDir,
): JobCheckpointSummary[] {
  return [...summaries].sort((a, b) => {
    let cmp = 0;
    switch (key) {
      case "jobName":
        cmp = a.jobName.localeCompare(b.jobName);
        break;
      case "lastSuccessTime":
        cmp =
          (a.lastSuccessTime?.getTime() ?? 0) -
          (b.lastSuccessTime?.getTime() ?? 0);
        break;
      case "checkpointInterval":
        cmp = a.checkpointInterval - b.checkpointInterval;
        break;
      case "avgDuration":
        cmp = a.avgDuration - b.avgDuration;
        break;
      case "totalStateSize":
        cmp = a.totalStateSize - b.totalStateSize;
        break;
      case "successRate":
        cmp = a.successRate - b.successRate;
        break;
      case "durationTrend":
        cmp = TREND_ORDER[a.durationTrend] - TREND_ORDER[b.durationTrend];
        break;
      case "stateSizeTrend":
        cmp = TREND_ORDER[a.stateSizeTrend] - TREND_ORDER[b.stateSizeTrend];
        break;
    }
    return dir === "asc" ? cmp : -cmp;
  });
}

// Column header

function SortHeader({
  label,
  sortKey,
  currentKey,
  currentDir,
  onSort,
  className,
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  currentDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const isActive = sortKey === currentKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      className={cn(
        "flex items-center gap-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500 hover:text-zinc-300 transition-colors",
        className,
      )}
    >
      {label}
      {isActive &&
        (currentDir === "asc" ? (
          <ChevronUp className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        ))}
    </button>
  );
}

// Table

export function CheckpointJobTable({
  summaries,
}: {
  summaries: JobCheckpointSummary[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("successRate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  const sorted = sortSummaries(summaries, sortKey, sortDir);

  if (summaries.length === 0) {
    return (
      <div className="glass-card flex items-center justify-center p-8 text-sm text-zinc-500">
        No checkpoint data available
      </div>
    );
  }

  const headerProps = { currentKey: sortKey, currentDir: sortDir, onSort: handleSort };

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border">
              <th className="px-3 py-2.5 text-left">
                <SortHeader label="Job Name" sortKey="jobName" {...headerProps} />
              </th>
              <th className="px-3 py-2.5 text-left">
                <SortHeader label="Last Success" sortKey="lastSuccessTime" {...headerProps} />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader label="Interval" sortKey="checkpointInterval" {...headerProps} className="justify-end" />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader label="Avg Duration" sortKey="avgDuration" {...headerProps} className="justify-end" />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader label="State Size" sortKey="totalStateSize" {...headerProps} className="justify-end" />
              </th>
              <th className="px-3 py-2.5 text-right">
                <SortHeader label="Success Rate" sortKey="successRate" {...headerProps} className="justify-end" />
              </th>
              <th className="px-3 py-2.5 text-center">
                <SortHeader label="Duration" sortKey="durationTrend" {...headerProps} className="justify-center" />
              </th>
              <th className="px-3 py-2.5 text-center">
                <SortHeader label="Size" sortKey="stateSizeTrend" {...headerProps} className="justify-center" />
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((s) => (
              <tr
                key={s.jobId}
                className="border-b border-dash-border/50 transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2 font-medium text-zinc-200 max-w-48 truncate">
                  {s.jobName}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {formatTime(s.lastSuccessTime)}
                </td>
                <td className="px-3 py-2 text-right text-zinc-400">
                  {s.checkpointInterval > 0
                    ? formatInterval(s.checkpointInterval)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-right text-zinc-300">
                  {formatDuration(s.avgDuration)}
                </td>
                <td className="px-3 py-2 text-right text-zinc-300">
                  {formatBytes(s.totalStateSize)}
                </td>
                <td className="px-3 py-2 text-right">
                  <span
                    className={cn(
                      "font-medium",
                      s.successRate > 95
                        ? "text-job-running"
                        : s.successRate > 80
                          ? "text-fr-amber"
                          : "text-job-failed",
                    )}
                  >
                    {s.successRate.toFixed(1)}%
                  </span>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center">
                    <TrendIndicator trend={s.durationTrend} />
                  </div>
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-center">
                    <TrendIndicator trend={s.stateSizeTrend} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
