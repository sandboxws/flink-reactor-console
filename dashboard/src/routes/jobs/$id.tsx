import { Button, Skeleton } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { AlertCircle, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { JobDetail } from "@/components/jobs/job-detail"
import { useClusterStore } from "@/stores/cluster-store"

/** Route: /jobs/$id — Job detail view with loading skeleton, error handling, and full job detail component. */
export const Route = createFileRoute("/jobs/$id")({
  component: JobPage,
})

function JobDetailSkeleton() {
  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header skeleton */}
      <div className="glass-card flex items-center gap-4 p-4">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-5 w-20" />
        <div className="ml-auto flex gap-2">
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
      {/* Tabs skeleton */}
      <div className="flex gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder skeletons never reorder
          <Skeleton key={i} className="h-8 w-24" />
        ))}
      </div>
      {/* Content skeleton */}
      <Skeleton className="h-[500px] w-full" />
    </div>
  )
}

function JobPage() {
  const { id } = Route.useParams()
  const fetchJobDetailAction = useClusterStore((s) => s.fetchJobDetail)
  const clearJobDetail = useClusterStore((s) => s.clearJobDetail)
  const cancelJob = useClusterStore((s) => s.cancelJob)
  const jobDetail = useClusterStore((s) => s.jobDetail)
  const jobDetailLoading = useClusterStore((s) => s.jobDetailLoading)
  const jobDetailError = useClusterStore((s) => s.jobDetailError)

  useEffect(() => {
    fetchJobDetailAction(id)
    return () => clearJobDetail()
  }, [id, fetchJobDetailAction, clearJobDetail])

  if (jobDetailLoading && !jobDetail) {
    return <JobDetailSkeleton />
  }

  if (jobDetailError && !jobDetail) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center p-8">
        <div className="flex max-w-lg flex-col items-center gap-5 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-job-failed/10">
            <AlertCircle className="h-6 w-6 text-job-failed" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-sm font-medium text-zinc-300">
              Failed to load job detail
            </h3>
            <p className="text-xs leading-relaxed text-zinc-500">
              {jobDetailError}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchJobDetailAction(id)}
          >
            <RefreshCw className="mr-2 h-3.5 w-3.5" />
            Retry
          </Button>
        </div>
      </div>
    )
  }

  if (!jobDetail) {
    return <JobDetailSkeleton />
  }

  return (
    <JobDetail job={jobDetail} onCancelJob={() => cancelJob(jobDetail.id)} />
  )
}
