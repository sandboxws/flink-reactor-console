"use client";

import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatDistanceToNow } from "date-fns";
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Copy,
  Check,
} from "lucide-react";
import type { TaskManager } from "@/data/cluster-types";
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
import { MemoryBar } from "./memory-bar";

// ---------------------------------------------------------------------------
// Sort logic
// ---------------------------------------------------------------------------

type SortKey =
  | "id"
  | "dataPort"
  | "lastHeartbeat"
  | "slots"
  | "cpuCores"
  | "physicalMemory"
  | "jvmHeap"
  | "managedMemory"
  | "networkMemory";

type SortDir = "asc" | "desc";

function sortTms(tms: TaskManager[], key: SortKey, dir: SortDir): TaskManager[] {
  const sorted = [...tms].sort((a, b) => {
    switch (key) {
      case "id":
        return a.id.localeCompare(b.id);
      case "dataPort":
        return a.dataPort - b.dataPort;
      case "lastHeartbeat":
        return a.lastHeartbeat.getTime() - b.lastHeartbeat.getTime();
      case "slots":
        return a.slotsFree - b.slotsFree;
      case "cpuCores":
        return a.cpuCores - b.cpuCores;
      case "physicalMemory":
        return a.physicalMemory - b.physicalMemory;
      case "jvmHeap":
        return a.metrics.heapUsed / a.metrics.heapMax -
          b.metrics.heapUsed / b.metrics.heapMax;
      case "managedMemory":
        return a.metrics.managedMemoryUsed / a.metrics.managedMemoryTotal -
          b.metrics.managedMemoryUsed / b.metrics.managedMemoryTotal;
      case "networkMemory":
        return a.metrics.nettyShuffleMemoryUsed / a.metrics.nettyShuffleMemoryTotal -
          b.metrics.nettyShuffleMemoryUsed / b.metrics.nettyShuffleMemoryTotal;
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
    return <ArrowUpDown className="size-3 opacity-0 group-hover:opacity-50" />;
  return dir === "asc" ? (
    <ArrowUp className="size-3" />
  ) : (
    <ArrowDown className="size-3" />
  );
}

// ---------------------------------------------------------------------------
// ID cell with copy and truncation
// ---------------------------------------------------------------------------

function TmIdCell({ id }: { id: string }) {
  const [copied, setCopied] = useState(false);
  const truncated = id.length > 12 ? id.slice(0, 12) + "\u2026" : id;

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
            className="group/id inline-flex items-center gap-1 font-mono text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <span>{truncated}</span>
            {copied ? (
              <Check className="size-3 shrink-0 text-job-running" />
            ) : (
              <Copy className="size-3 shrink-0 opacity-0 group-hover/id:opacity-100" />
            )}
          </button>
        </TooltipTrigger>
        <TooltipContent side="top">{copied ? "Copied!" : id}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Heartbeat cell with live update
// ---------------------------------------------------------------------------

function HeartbeatCell({ date }: { date: Date }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <span className="text-xs text-zinc-400">
      {formatDistanceToNow(date, { addSuffix: true })}
    </span>
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

const columns: ColumnDef[] = [
  { key: "id", label: "ID" },
  { key: "dataPort", label: "Data Port", align: "text-right" },
  { key: "lastHeartbeat", label: "Last Heartbeat" },
  { key: "slots", label: "Slots" },
  { key: "cpuCores", label: "CPU Cores", align: "text-right" },
  { key: "physicalMemory", label: "Physical Mem" },
  { key: "jvmHeap", label: "JVM Heap" },
  { key: "managedMemory", label: "Managed Mem" },
  { key: "networkMemory", label: "Network Mem" },
];

// ---------------------------------------------------------------------------
// TaskManagerList
// ---------------------------------------------------------------------------

export function TaskManagerList({
  taskManagers,
  selectedId,
}: {
  taskManagers: TaskManager[];
  selectedId?: string | null;
}) {
  const router = useRouter();
  const [sortKey, setSortKey] = useState<SortKey>("id");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  const sorted = useMemo(
    () => sortTms(taskManagers, sortKey, sortDir),
    [taskManagers, sortKey, sortDir],
  );

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (taskManagers.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-600">
        No task managers registered
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
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((tm) => (
          <TableRow
            key={tm.id}
            className={cn(
              "data-row cursor-pointer",
              selectedId === tm.id && "data-row-selected",
            )}
            onClick={() => router.push(`/task-managers/${tm.id}`)}
          >
            <TableCell>
              <TmIdCell id={tm.id} />
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-zinc-400">
              {tm.dataPort}
            </TableCell>
            <TableCell>
              <HeartbeatCell date={tm.lastHeartbeat} />
            </TableCell>
            <TableCell>
              <span className="text-xs tabular-nums text-zinc-300">
                {tm.slotsTotal}
                <span className="text-zinc-600"> / </span>
                {tm.slotsFree}
                <span className="ml-1 text-zinc-600">free</span>
              </span>
            </TableCell>
            <TableCell className="text-right text-xs tabular-nums text-zinc-400">
              {tm.cpuCores}
            </TableCell>
            <TableCell>
              <MemoryBar
                used={tm.physicalMemory - tm.physicalMemory * 0.25}
                total={tm.physicalMemory}
              />
            </TableCell>
            <TableCell>
              <MemoryBar
                used={tm.metrics.heapUsed}
                total={tm.metrics.heapMax}
              />
            </TableCell>
            <TableCell>
              <MemoryBar
                used={tm.metrics.managedMemoryUsed}
                total={tm.metrics.managedMemoryTotal}
              />
            </TableCell>
            <TableCell>
              <MemoryBar
                used={tm.metrics.nettyShuffleMemoryUsed}
                total={tm.metrics.nettyShuffleMemoryTotal}
              />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
