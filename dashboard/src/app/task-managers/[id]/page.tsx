"use client"

import { Loader2, SearchX } from "lucide-react"
import { use, useEffect } from "react"
import { EmptyState } from "@/components/shared/empty-state"
import { TaskManagerDetail } from "@/components/task-managers/task-manager-detail"
import { useClusterStore } from "@/stores/cluster-store"

export default function TaskManagerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const fetchTmDetail = useClusterStore((s) => s.fetchTaskManagerDetail)
  const clearTmDetail = useClusterStore((s) => s.clearTaskManagerDetail)
  const tm = useClusterStore((s) => s.taskManagerDetail)
  const loading = useClusterStore((s) => s.taskManagerDetailLoading)
  const error = useClusterStore((s) => s.taskManagerDetailError)

  useEffect(() => {
    initialize()
    startPolling()
    fetchTmDetail(id)
    return () => {
      stopPolling()
      clearTmDetail()
    }
  }, [id, initialize, startPolling, stopPolling, fetchTmDetail, clearTmDetail])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="size-6 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return <EmptyState icon={SearchX} message={error} />
  }

  if (!tm) {
    return <EmptyState icon={SearchX} message="Task Manager not found" />
  }

  return <TaskManagerDetail tm={tm} />
}
