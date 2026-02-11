"use client";

import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import type { JobVertex, JobVertexStatus, TaskStatus } from "@/data/cluster-types";
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

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${bytes} B`;
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min < 60) return `${min}m ${sec}s`;
  const hr = Math.floor(min / 60);
  return `${hr}h ${min % 60}m`;
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
// Back-pressure indicator color (for left border)
// ---------------------------------------------------------------------------

function bpColor(busyTimeMsPerSecond: number): string {
  const pct = busyTimeMsPerSecond / 10; // ms/s → percentage (0-100)
  if (pct < 30) return "border-l-job-running"; // green
  if (pct < 60) return "border-l-fr-amber"; // amber
  return "border-l-job-failed"; // red
}

// ---------------------------------------------------------------------------
// Back-pressure text color (for metric value)
// ---------------------------------------------------------------------------

function bpTextColor(backPressuredMsPerSecond: number): string {
  if (backPressuredMsPerSecond < 300) return "text-job-running";
  if (backPressuredMsPerSecond < 600) return "text-fr-amber";
  return "text-job-failed";
}

// ---------------------------------------------------------------------------
// Status dot
// ---------------------------------------------------------------------------

const STATUS_DOT_COLORS: Record<JobVertexStatus, string> = {
  RUNNING: "bg-job-running",
  FINISHED: "bg-job-finished",
  FAILED: "bg-job-failed",
  CANCELED: "bg-job-cancelled",
  CREATED: "bg-job-created",
};

function StatusDot({ status }: { status: JobVertexStatus }) {
  return (
    <span
      className={cn(
        "inline-block size-2 shrink-0 rounded-full",
        STATUS_DOT_COLORS[status] ?? "bg-zinc-500",
      )}
    />
  );
}

// ---------------------------------------------------------------------------
// OperatorNode
// ---------------------------------------------------------------------------

type OperatorNodeData = { vertex: JobVertex };

export function OperatorNode({ data }: NodeProps & { data: OperatorNodeData }) {
  const { vertex } = data;
  const { metrics } = vertex;

  return (
    <div
      className={cn(
        "glass-card w-[320px] border-l-[3px] overflow-hidden",
        bpColor(metrics.busyTimeMsPerSecond),
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-dash-border !border-dash-elevated !size-2" />

      {/* ── Header ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 bg-dash-elevated px-3 py-2">
        <StatusDot status={vertex.status} />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">
          {vertex.name}
        </span>
        <span className="shrink-0 rounded bg-white/5 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-zinc-400">
          &times;{vertex.parallelism}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-zinc-500">
          {formatDuration(vertex.duration)}
        </span>
      </div>

      {/* ── Body: metric grid ──────────────────────────────────── */}
      <div className="grid grid-cols-[auto_1fr_auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-[10px]">
        <span className="text-zinc-500">Records In</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatSI(metrics.recordsIn)}
        </span>
        <span className="text-zinc-500">Records Out</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatSI(metrics.recordsOut)}
        </span>

        <span className="text-zinc-500">Bytes In</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatBytes(metrics.bytesIn)}
        </span>
        <span className="text-zinc-500">Bytes Out</span>
        <span className="text-right tabular-nums text-zinc-300">
          {formatBytes(metrics.bytesOut)}
        </span>

        <span className="text-zinc-500">Busy</span>
        <span className="text-right tabular-nums text-zinc-300">
          {metrics.busyTimeMsPerSecond} ms/s
        </span>
        <span className="text-zinc-500">Backpressure</span>
        <span
          className={cn(
            "text-right tabular-nums",
            bpTextColor(metrics.backPressuredTimeMsPerSecond),
          )}
        >
          {metrics.backPressuredTimeMsPerSecond} ms/s
        </span>
      </div>

      {/* ── Footer: task bar ───────────────────────────────────── */}
      <div className="px-3 pb-2">
        <MiniTaskBar vertex={vertex} />
      </div>

      <Handle type="source" position={Position.Right} className="!bg-dash-border !border-dash-elevated !size-2" />
    </div>
  );
}
