import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo } from "react"
import { Skeleton, TimeRange, type TimeRangeValue, type TimeRangePreset } from "@flink-reactor/ui"
import { JobHistoryTable } from "@/components/jobs/job-history-table"
import { useJobHistoryStore } from "@/stores/job-history-store"

/** Route: /jobs/completed — Lists finished Flink jobs with time-range filtering, sorting, and pagination. */
export const Route = createFileRoute("/jobs/completed")({
  component: CompletedJobs,
})

type StoreTimeRange = "LAST_1H" | "LAST_2H" | "LAST_24H" | "LAST_7D" | "LAST_30D"

const JOB_PRESETS: TimeRangePreset[] = [
  { label: "1 Hour", minutes: 60 },
  { label: "2 Hours", minutes: 120 },
  { label: "24 Hours", minutes: 1440 },
  { label: "7 Days", minutes: 10080 },
  { label: "30 Days", minutes: 43200 },
]

const ENUM_TO_MINUTES: Record<StoreTimeRange, number> = {
  LAST_1H: 60,
  LAST_2H: 120,
  LAST_24H: 1440,
  LAST_7D: 10080,
  LAST_30D: 43200,
}

const MINUTES_TO_ENUM: Record<number, StoreTimeRange> = {
  60: "LAST_1H",
  120: "LAST_2H",
  1440: "LAST_24H",
  10080: "LAST_7D",
  43200: "LAST_30D",
}

function CompletedJobs() {
  const entries = useJobHistoryStore((s) => s.entries)
  const totalCount = useJobHistoryStore((s) => s.totalCount)
  const hasNextPage = useJobHistoryStore((s) => s.hasNextPage)
  const currentPage = useJobHistoryStore((s) => s.currentPage)
  const pageSize = useJobHistoryStore((s) => s.pageSize)
  const timeRange = useJobHistoryStore((s) => s.timeRange)
  const orderField = useJobHistoryStore((s) => s.orderField)
  const orderDirection = useJobHistoryStore((s) => s.orderDirection)
  const isLoading = useJobHistoryStore((s) => s.isLoading)
  const fetch = useJobHistoryStore((s) => s.fetch)
  const setTimeRange = useJobHistoryStore((s) => s.setTimeRange)
  const setOrderBy = useJobHistoryStore((s) => s.setOrderBy)
  const nextPage = useJobHistoryStore((s) => s.nextPage)
  const prevPage = useJobHistoryStore((s) => s.prevPage)

  useEffect(() => {
    fetch()
  }, [fetch])

  // Convert store enum → TimeRangeValue for the component
  const rangeValue = useMemo<TimeRangeValue>(() => {
    const minutes = ENUM_TO_MINUTES[timeRange as StoreTimeRange]
    const end = new Date()
    const start = new Date(end.getTime() - minutes * 60_000)
    return { start, end }
  }, [timeRange])

  // Convert TimeRangeValue → store enum on change
  function handleTimeRangeChange(val: TimeRangeValue) {
    if (!val.start) return
    const diffMin = Math.round((Date.now() - val.start.getTime()) / 60_000)
    const match = JOB_PRESETS.reduce((best, p) =>
      Math.abs(p.minutes - diffMin) < Math.abs(best.minutes - diffMin) ? p : best,
    )
    const enumVal = MINUTES_TO_ENUM[match.minutes]
    if (enumVal) setTimeRange(enumVal)
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Completed Jobs</h1>
        <TimeRange
          value={rangeValue}
          onChange={handleTimeRangeChange}
          variant="full"
          presets={JOB_PRESETS}
        />
      </div>
      <div className="glass-card overflow-hidden">
        {isLoading && entries.length === 0 ? (
          <div className="w-full">
            {/* Header row */}
            <div className="flex gap-4 border-b border-dash-border px-4 py-3">
              {[44, 10, 18, 18, 10].map((w, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
                <Skeleton key={i} className="h-4" style={{ width: `${w}%` }} />
              ))}
            </div>
            {/* Body rows */}
            {Array.from({ length: 5 }).map((_, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
              <div key={i} className="flex gap-4 border-b border-dash-border/50 px-4 py-3">
                <Skeleton className="h-4 w-[44%]" />
                <Skeleton className="h-4 w-[10%]" />
                <Skeleton className="h-4 w-[18%]" />
                <Skeleton className="h-4 w-[18%]" />
                <Skeleton className="h-4 w-[10%]" />
              </div>
            ))}
          </div>
        ) : (
          <JobHistoryTable
            entries={entries}
            totalCount={totalCount}
            hasNextPage={hasNextPage}
            currentPage={currentPage}
            pageSize={pageSize}
            orderField={orderField}
            orderDirection={orderDirection}
            onSort={setOrderBy}
            onNextPage={nextPage}
            onPrevPage={prevPage}
          />
        )}
      </div>
    </div>
  )
}
