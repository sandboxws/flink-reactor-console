/**
 * @module task-manager-list
 *
 * Sortable table of all registered task managers with inline memory bars,
 * slot counts, and a live heartbeat indicator. Clicking a row navigates
 * to the {@link TaskManagerDetail} page.
 */
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@flink-reactor/ui"
import { useNavigate } from "@tanstack/react-router"
import { formatDistanceToNow } from "date-fns"
import { Check, Copy } from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import type { TaskManager } from "@flink-reactor/ui"
import { SortIcon } from "@/components/shared/sort-icon"
import { cn } from "@/lib/cn"
import { MemoryBar } from "./memory-bar"

// ---------------------------------------------------------------------------
// Sort logic
// ---------------------------------------------------------------------------

/** Column key used for table sort state. */
type SortKey =
  | "id"
  | "dataPort"
  | "lastHeartbeat"
  | "slots"
  | "cpuCores"
  | "physicalMemory"
  | "jvmHeap"
  | "managedMemory"
  | "networkMemory"

/** Sort direction. */
type SortDir = "asc" | "desc"

/** Sort an array of {@link TaskManager} entries by the given key and direction. */
function sortTms(
  tms: TaskManager[],
  key: SortKey,
  dir: SortDir,
): TaskManager[] {
  const sorted = [...tms].sort((a, b) => {
    switch (key) {
      case "id":
        return a.id.localeCompare(b.id)
      case "dataPort":
        return a.dataPort - b.dataPort
      case "lastHeartbeat":
        return a.lastHeartbeat.getTime() - b.lastHeartbeat.getTime()
      case "slots":
        return a.slotsFree - b.slotsFree
      case "cpuCores":
        return a.cpuCores - b.cpuCores
      case "physicalMemory":
        return a.physicalMemory - b.physicalMemory
      case "jvmHeap":
        return (
          a.metrics.heapUsed / a.metrics.heapMax -
          b.metrics.heapUsed / b.metrics.heapMax
        )
      case "managedMemory":
        return (
          a.metrics.managedMemoryUsed / a.metrics.managedMemoryTotal -
          b.metrics.managedMemoryUsed / b.metrics.managedMemoryTotal
        )
      case "networkMemory":
        return (
          a.metrics.nettyShuffleMemoryUsed / a.metrics.nettyShuffleMemoryTotal -
          b.metrics.nettyShuffleMemoryUsed / b.metrics.nettyShuffleMemoryTotal
        )
      default:
        return 0
    }
  })
  return dir === "desc" ? sorted.reverse() : sorted
}

// ---------------------------------------------------------------------------
// ID cell with copy and truncation
// ---------------------------------------------------------------------------

/** Truncated task manager ID with click-to-copy and tooltip showing the full value. */
function TmIdCell({ id }: { id: string }) {
  const [copied, setCopied] = useState(false)
  const truncated = id.length > 12 ? `${id.slice(0, 12)}\u2026` : id

  const handleCopy = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation()
      navigator.clipboard.writeText(id)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    },
    [id],
  )

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
  )
}

// ---------------------------------------------------------------------------
// Heartbeat cell with live update
// ---------------------------------------------------------------------------

/** Relative-time cell that re-renders every second to keep "X ago" labels fresh. */
function HeartbeatCell({ date }: { date: Date }) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <span className="text-xs text-zinc-400">
      {formatDistanceToNow(date, { addSuffix: true })}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Column definitions
// ---------------------------------------------------------------------------

/** Metadata for a single table column header. */
type ColumnDef = {
  /** Sort key this column maps to. */
  key: SortKey
  /** Display label shown in the header. */
  label: string
  /** Optional Tailwind text-alignment class (e.g. "text-right"). */
  align?: string
}

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
]

// ---------------------------------------------------------------------------
// TaskManagerList
// ---------------------------------------------------------------------------

/**
 * Sortable table listing all task managers in the cluster.
 *
 * Each row shows the TM identifier, data port, last heartbeat, slot usage,
 * CPU cores, and inline {@link MemoryBar} visualizations for physical memory,
 * JVM heap, managed memory, and network memory. Rows are clickable and navigate
 * to the individual task manager detail page.
 */
export function TaskManagerList({
  taskManagers,
  selectedId,
}: {
  taskManagers: TaskManager[]
  selectedId?: string | null
}) {
  const navigate = useNavigate()
  const [sortKey, setSortKey] = useState<SortKey>("id")
  const [sortDir, setSortDir] = useState<SortDir>("asc")

  const sorted = useMemo(
    () => sortTms(taskManagers, sortKey, sortDir),
    [taskManagers, sortKey, sortDir],
  )

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("desc")
    }
  }

  if (taskManagers.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-zinc-600">
        No task managers registered
      </p>
    )
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
                <SortIcon column={col.key} active={sortKey} direction={sortDir} />
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
            onClick={() => navigate({ to: `/task-managers/${tm.id}` })}
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
  )
}
