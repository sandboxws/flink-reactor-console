import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react"
import { useState } from "react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { BottleneckScore } from "@/data/bottleneck-analyzer"
import { cn } from "@/lib/cn"

type SortColumn = "score" | "vertex" | "job" | "parallelism" | "bp" | "busy"
type SortDir = "asc" | "desc"

const _bpColors: Record<string, string> = {
  low: "text-job-running",
  medium: "text-fr-amber",
  high: "text-job-failed",
}

function bpLabel(factor: number): { label: string; color: string } {
  if (factor <= 25) return { label: "ok", color: "text-job-running" }
  if (factor <= 60) return { label: "low", color: "text-fr-amber" }
  return { label: "high", color: "text-job-failed" }
}

const severityBadge: Record<string, { label: string; className: string }> = {
  low: {
    label: "Low",
    className: "bg-job-running/10 text-job-running border-job-running/30",
  },
  medium: {
    label: "Medium",
    className: "bg-fr-amber/10 text-fr-amber border-fr-amber/30",
  },
  high: {
    label: "High",
    className: "bg-job-failed/10 text-job-failed border-job-failed/30",
  },
}

function scoreBarColor(score: number): string {
  if (score <= 30) return "bg-job-running"
  if (score <= 60) return "bg-fr-amber"
  return "bg-job-failed"
}

export function BottleneckTable({ scores }: { scores: BottleneckScore[] }) {
  const [sortCol, setSortCol] = useState<SortColumn>("score")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  const handleSort = (col: SortColumn) => {
    if (sortCol === col) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortCol(col)
      setSortDir("desc")
    }
  }

  const sorted = [...scores].sort((a, b) => {
    const mul = sortDir === "asc" ? 1 : -1
    switch (sortCol) {
      case "score":
        return (a.score - b.score) * mul
      case "vertex":
        return a.vertexName.localeCompare(b.vertexName) * mul
      case "job":
        return a.jobName.localeCompare(b.jobName) * mul
      case "parallelism":
        return (a.parallelism - b.parallelism) * mul
      case "bp":
        return (a.factors.backpressure - b.factors.backpressure) * mul
      case "busy":
        return (a.factors.busyTime - b.factors.busyTime) * mul
      default:
        return 0
    }
  })

  function SortIcon({ col }: { col: SortColumn }) {
    if (sortCol !== col) return <ArrowUpDown className="size-3 text-zinc-600" />
    return sortDir === "asc" ? (
      <ArrowUp className="size-3 text-zinc-300" />
    ) : (
      <ArrowDown className="size-3 text-zinc-300" />
    )
  }

  if (scores.length === 0) {
    return (
      <div className="glass-card flex items-center justify-center py-12 text-sm text-zinc-500">
        No vertices to display
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="border-dash-border hover:bg-transparent">
            <TableHead>
              <button
                type="button"
                onClick={() => handleSort("vertex")}
                className="flex items-center gap-1 text-xs"
              >
                Vertex <SortIcon col="vertex" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => handleSort("job")}
                className="flex items-center gap-1 text-xs"
              >
                Job <SortIcon col="job" />
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button
                type="button"
                onClick={() => handleSort("parallelism")}
                className="ml-auto flex items-center gap-1 text-xs"
              >
                P <SortIcon col="parallelism" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => handleSort("bp")}
                className="flex items-center gap-1 text-xs"
              >
                BP Level <SortIcon col="bp" />
              </button>
            </TableHead>
            <TableHead className="text-right">
              <button
                type="button"
                onClick={() => handleSort("busy")}
                className="flex items-center gap-1 text-xs"
              >
                Busy% <SortIcon col="busy" />
              </button>
            </TableHead>
            <TableHead>
              <button
                type="button"
                onClick={() => handleSort("score")}
                className="flex items-center gap-1 text-xs"
              >
                Score <SortIcon col="score" />
              </button>
            </TableHead>
            <TableHead>Severity</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((s) => {
            const bp = bpLabel(s.factors.backpressure)
            const badge = severityBadge[s.severity]
            return (
              <TableRow
                key={`${s.jobId}-${s.vertexId}`}
                className="border-dash-border"
              >
                <TableCell className="max-w-[180px] truncate text-xs text-zinc-200">
                  {s.vertexName}
                </TableCell>
                <TableCell className="max-w-[140px] truncate text-xs text-zinc-400">
                  {s.jobName}
                </TableCell>
                <TableCell className="text-right text-xs text-zinc-400">
                  {s.parallelism}
                </TableCell>
                <TableCell>
                  <span className={cn("text-xs font-medium", bp.color)}>
                    {bp.label}
                  </span>
                </TableCell>
                <TableCell className="text-right text-xs text-zinc-300">
                  {Math.round(s.factors.busyTime)}%
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-16 rounded-full bg-zinc-800">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all",
                          scoreBarColor(s.score),
                        )}
                        style={{ width: `${s.score}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-zinc-300">
                      {s.score}
                    </span>
                  </div>
                </TableCell>
                <TableCell>
                  <span
                    className={cn(
                      "rounded-full border px-2 py-0.5 text-[10px] font-medium",
                      badge.className,
                    )}
                  >
                    {badge.label}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
