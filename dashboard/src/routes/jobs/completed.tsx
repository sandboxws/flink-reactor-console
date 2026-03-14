import { createFileRoute } from "@tanstack/react-router"
import { useEffect } from "react"
import { JobHistoryTable } from "@/components/jobs/job-history-table"
import { TimeFilterBar } from "@/components/jobs/time-filter-bar"
import { useJobHistoryStore } from "@/stores/job-history-store"

export const Route = createFileRoute("/jobs/completed")({
  component: CompletedJobs,
})

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

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Completed Jobs</h1>
        <TimeFilterBar active={timeRange} onChange={setTimeRange} />
      </div>
      <div className="glass-card overflow-hidden">
        {isLoading && entries.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-600">
            Loading job history...
          </p>
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
