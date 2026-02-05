"use client";

import { useMemo, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  XCircle,
  Copy,
  Check,
} from "lucide-react";
import type { FlinkJob } from "@/data/cluster-types";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";
import { JobStatusBadge } from "./job-status-badge";
import { TaskCountsBar } from "./task-counts-bar";
import { DurationCell } from "./duration-cell";

// ---------------------------------------------------------------------------
// Sort logic
// ---------------------------------------------------------------------------

type SortKey = "name" | "id" | "status" | "startTime" | "endTime" | "duration" | "tasks";
type SortDir = "asc" | "desc";

function getDuration(job: FlinkJob): number {
  return job.status === "RUNNING"
    ? Date.now() - job.startTime.getTime()
    : job.duration;
}

function getTaskTotal(job: FlinkJob): number {
  return Object.values(job.tasks).reduce((a, b) => a + b, 0);
}

function sortJobs(jobs: FlinkJob[], key: SortKey, dir: SortDir): FlinkJob[] {
  const sorted = [...jobs].sort((a, b) => {
    switch (key) {
      case "name":
        return a.name.localeCompare(b.name);
      case "id":
        return a.id.localeCompare(b.id);
      case "status":
        return a.status.localeCompare(b.status);
      case "startTime":
        return a.startTime.getTime() - b.startTime.getTime();
      case "endTime":
        return (a.endTime?.getTime() ?? 0) - (b.endTime?.getTime() ?? 0);
      case "duration":
        return getDuration(a) - getDuration(b);
      case "tasks":
        return getTaskTotal(a) - getTaskTotal(b);
    }
  });
  return dir === "desc" ? sorted.reverse() : sorted;
}

// ---------------------------------------------------------------------------
// Sort icon
// ---------------------------------------------------------------------------

function SortIcon({
  column,
  active,
  dir,
}: {
  column: string;
  active: string;
  dir: SortDir;
}) {
  if (column !== active)
    return (
      <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-50" />
    );
  return dir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

// ---------------------------------------------------------------------------
// Copy-on-click Job ID cell
// ---------------------------------------------------------------------------

function JobIdCell({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    },
    [id],
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleCopy}
            className="group/id inline-flex max-w-28 items-center gap-1 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <span className="truncate">{id}</span>
            {copied ? (
              <Check className="size-3 shrink-0 text-job-running" />
            ) : (
              <Copy className="size-3 shrink-0 opacity-0 group-hover/id:opacity-100" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent>{copied ? "Copied!" : id}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Cancel button
// ---------------------------------------------------------------------------

function CancelButton({
  jobId,
  onCancel,
}: {
  jobId: string;
  onCancel: (id: string) => void;
}) {
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onCancel(jobId);
    },
    [jobId, onCancel],
  );

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={handleClick}
            className="rounded p-1 text-zinc-600 transition-colors hover:bg-job-failed/10 hover:text-job-failed"
          >
            <XCircle className="size-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent>Cancel job</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

type ColumnDef = {
  key: SortKey;
  label: string;
  align?: string;
};

const runningColumns: ColumnDef[] = [
  { key: "name", label: "Job Name" },
  { key: "id", label: "Job ID" },
  { key: "status", label: "Status" },
  { key: "startTime", label: "Start Time" },
  { key: "duration", label: "Duration", align: "text-right" },
  { key: "tasks", label: "Tasks", align: "text-right" },
];

const completedColumns: ColumnDef[] = [
  { key: "name", label: "Job Name" },
  { key: "id", label: "Job ID" },
  { key: "status", label: "Status" },
  { key: "startTime", label: "Start Time" },
  { key: "endTime", label: "End Time" },
  { key: "duration", label: "Duration", align: "text-right" },
  { key: "tasks", label: "Tasks", align: "text-right" },
];

// ---------------------------------------------------------------------------
// JobsTable
// ---------------------------------------------------------------------------

export function JobsTable({
  mode,
  jobs,
  onCancelJob,
}: {
  mode: "running" | "completed";
  jobs: FlinkJob[];
  onCancelJob?: (jobId: string) => void;
}) {
  const router = useRouter();
  const isRunning = mode === "running";
  const columns = isRunning ? runningColumns : completedColumns;

  const defaultSortKey: SortKey = isRunning ? "startTime" : "endTime";
  const [sortKey, setSortKey] = useState<SortKey>(defaultSortKey);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const sorted = useMemo(
    () => sortJobs(jobs, sortKey, sortDir),
    [jobs, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (jobs.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-600">
        {isRunning ? "No running jobs" : "No completed jobs"}
      </p>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          {columns.map((col) => (
            <TableHead
              key={col.key}
              className={cn("group cursor-pointer select-none", col.align)}
              onClick={() => toggleSort(col.key)}
            >
              <span className="inline-flex items-center gap-1">
                {col.label}
                <SortIcon column={col.key} active={sortKey} dir={sortDir} />
              </span>
            </TableHead>
          ))}
          {isRunning && <TableHead className="w-10" />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((job) => (
          <TableRow
            key={job.id}
            className="cursor-pointer"
            onClick={() => router.push(`/jobs/${job.id}`)}
          >
            <TableCell className="max-w-48">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="block truncate font-medium">
                      {job.name}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>{job.name}</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </TableCell>
            <TableCell>
              <JobIdCell id={job.id} />
            </TableCell>
            <TableCell>
              <JobStatusBadge status={job.status} />
            </TableCell>
            <TableCell className="text-xs text-zinc-400">
              {format(job.startTime, "yyyy-MM-dd HH:mm:ss")}
            </TableCell>
            {!isRunning && (
              <TableCell className="text-xs text-zinc-400">
                {job.endTime
                  ? format(job.endTime, "yyyy-MM-dd HH:mm:ss")
                  : "—"}
              </TableCell>
            )}
            <TableCell className="text-right">
              <DurationCell
                startTime={job.startTime}
                endTime={job.endTime}
                isRunning={job.status === "RUNNING"}
              />
            </TableCell>
            <TableCell>
              <div className="flex justify-end">
                <TaskCountsBar tasks={job.tasks} />
              </div>
            </TableCell>
            {isRunning && onCancelJob && (
              <TableCell>
                <CancelButton jobId={job.id} onCancel={onCancelJob} />
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
