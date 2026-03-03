"use client"

import { formatDistanceToNow } from "date-fns"
import { ArrowDownWideNarrow, Clock } from "lucide-react"
import { useMemo } from "react"
import { Bar, BarChart } from "recharts"
import { SourceBadge } from "@/components/shared/source-badge"
import type { ErrorGroup } from "@/data/types"
import { cn } from "@/lib/cn"
import { useErrorStore } from "@/stores/error-store"

// ---------------------------------------------------------------------------
// Mini sparkline — 12 buckets showing occurrence frequency
// ---------------------------------------------------------------------------

const SPARK_BUCKETS = 12

function buildSparkData(occurrences: Date[]): { v: number }[] {
  if (occurrences.length < 2) {
    return Array.from({ length: SPARK_BUCKETS }, () => ({
      v: occurrences.length,
    }))
  }

  const min = occurrences[0].getTime()
  const max = occurrences[occurrences.length - 1].getTime()
  const range = Math.max(max - min, 1)
  const bucketSize = range / SPARK_BUCKETS

  const buckets = Array.from({ length: SPARK_BUCKETS }, () => ({ v: 0 }))
  for (const d of occurrences) {
    const idx = Math.min(
      Math.floor((d.getTime() - min) / bucketSize),
      SPARK_BUCKETS - 1,
    )
    buckets[idx].v++
  }
  return buckets
}

function MiniSparkline({ occurrences }: { occurrences: Date[] }) {
  const data = useMemo(() => buildSparkData(occurrences), [occurrences])

  return (
    <BarChart
      width={60}
      height={16}
      data={data}
      margin={{ top: 0, right: 0, bottom: 0, left: 0 }}
    >
      <Bar dataKey="v" fill="var(--color-log-error)" radius={[1, 1, 0, 0]} />
    </BarChart>
  )
}

// ---------------------------------------------------------------------------
// Group card
// ---------------------------------------------------------------------------

function ErrorGroupCard({
  group,
  isSelected,
  onSelect,
}: {
  group: ErrorGroup
  isSelected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full text-left rounded-lg p-3 transition-all border",
        isSelected
          ? "border-log-error/40 bg-log-error/[0.06]"
          : "border-transparent bg-dash-elevated/50 hover:bg-dash-hover",
      )}
    >
      {/* Header row: class name + count */}
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-medium text-log-error truncate">
          {group.exceptionClass}
        </span>
        <span className="shrink-0 rounded bg-log-error/10 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-log-error">
          {group.count}
        </span>
      </div>

      {/* Truncated message */}
      <p className="mt-1 text-[11px] leading-snug text-zinc-500 line-clamp-2">
        {group.message || "No message"}
      </p>

      {/* Footer: last seen + sparkline */}
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-[10px] text-zinc-600">
          {formatDistanceToNow(group.lastSeen, { addSuffix: true })}
        </span>
        <MiniSparkline occurrences={group.occurrences} />
      </div>

      {/* Affected sources */}
      {group.affectedSources.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {group.affectedSources.map((src) => (
            <SourceBadge key={src.id} source={src} />
          ))}
        </div>
      )}
    </button>
  )
}

// ---------------------------------------------------------------------------
// Group list
// ---------------------------------------------------------------------------

export function ErrorGroupList({ groups }: { groups: ErrorGroup[] }) {
  const selectedGroupId = useErrorStore((s) => s.selectedGroupId)
  const selectGroup = useErrorStore((s) => s.selectGroup)
  const sortBy = useErrorStore((s) => s.sortBy)
  const setSortBy = useErrorStore((s) => s.setSortBy)

  const sorted = useMemo(() => {
    const copy = [...groups]
    if (sortBy === "count") {
      copy.sort((a, b) => b.count - a.count)
    } else if (sortBy === "lastSeen") {
      copy.sort((a, b) => b.lastSeen.getTime() - a.lastSeen.getTime())
    } else {
      copy.sort((a, b) => a.firstSeen.getTime() - b.firstSeen.getTime())
    }
    return copy
  }, [groups, sortBy])

  return (
    <div className="flex h-full flex-col">
      {/* Sort controls */}
      <div className="flex items-center gap-1 border-b border-dash-border px-3 py-2">
        <span className="text-[10px] text-zinc-600 mr-1">Sort:</span>
        <button
          type="button"
          onClick={() => setSortBy("count")}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
            sortBy === "count"
              ? "bg-white/[0.08] text-white"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <ArrowDownWideNarrow className="size-3" />
          Most frequent
        </button>
        <button
          type="button"
          onClick={() => setSortBy("lastSeen")}
          className={cn(
            "flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] transition-colors",
            sortBy === "lastSeen"
              ? "bg-white/[0.08] text-white"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          <Clock className="size-3" />
          Most recent
        </button>
      </div>

      {/* Group list */}
      <div className="flex-1 overflow-auto p-2 space-y-1.5">
        {sorted.map((group) => (
          <ErrorGroupCard
            key={group.id}
            group={group}
            isSelected={selectedGroupId === group.id}
            onSelect={() =>
              selectGroup(selectedGroupId === group.id ? null : group.id)
            }
          />
        ))}
      </div>
    </div>
  )
}
