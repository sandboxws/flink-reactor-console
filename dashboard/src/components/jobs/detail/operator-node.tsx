"use client";

import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { JobVertex, TaskStatus } from "@/data/cluster-types";
import { cn } from "@/lib/cn";

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatSI(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---------------------------------------------------------------------------
// Mini task-status bar (same colors as TaskCountsBar)
// ---------------------------------------------------------------------------

const segments: { key: TaskStatus; color: string }[] = [
  { key: "pending", color: "bg-job-created" },
  { key: "running", color: "bg-job-running" },
  { key: "finished", color: "bg-job-finished" },
  { key: "canceling", color: "bg-job-cancelled" },
  { key: "failed", color: "bg-job-failed" },
];

function MiniTaskBar({ vertex }: { vertex: JobVertex }) {
  const total = Object.values(vertex.tasks).reduce((a, b) => a + b, 0);
  if (total === 0) return null;

  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-white/5">
      {segments.map(
        (seg) =>
          vertex.tasks[seg.key] > 0 && (
            <div
              key={seg.key}
              className={cn("h-full", seg.color)}
              style={{ width: `${(vertex.tasks[seg.key] / total) * 100}%` }}
            />
          ),
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Back-pressure indicator color
// ---------------------------------------------------------------------------

function bpColor(busyTimeMsPerSecond: number): string {
  const pct = busyTimeMsPerSecond / 10; // ms/s → percentage (0-100)
  if (pct < 30) return "border-l-job-running"; // green
  if (pct < 60) return "border-l-fr-amber"; // amber
  return "border-l-job-failed"; // red
}

// ---------------------------------------------------------------------------
// OperatorNode
// ---------------------------------------------------------------------------

type OperatorNodeData = { vertex: JobVertex };

export function OperatorNode({ data }: NodeProps & { data: OperatorNodeData }) {
  const { vertex } = data;

  return (
    <div
      className={cn(
        "glass-card w-[260px] border-l-[3px] p-3",
        bpColor(vertex.metrics.busyTimeMsPerSecond),
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-dash-border !border-dash-elevated !size-2" />

      {/* Operator name + parallelism */}
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium text-zinc-200">
          {vertex.name}
        </span>
        <span className="shrink-0 rounded bg-dash-elevated px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
          x{vertex.parallelism}
        </span>
      </div>

      {/* Mini task bar */}
      <div className="mt-2">
        <MiniTaskBar vertex={vertex} />
      </div>

      {/* Records in/out */}
      <div className="mt-2 flex items-center justify-between text-[10px] tabular-nums text-zinc-500">
        {vertex.metrics.recordsIn > 0 && (
          <span>{formatSI(vertex.metrics.recordsIn)} in</span>
        )}
        {vertex.metrics.recordsOut > 0 && (
          <span>{formatSI(vertex.metrics.recordsOut)} out</span>
        )}
        {vertex.metrics.recordsIn === 0 && vertex.metrics.recordsOut === 0 && (
          <span className="text-zinc-600">no data</span>
        )}
      </div>

      <Handle type="source" position={Position.Right} className="!bg-dash-border !border-dash-elevated !size-2" />
    </div>
  );
}
