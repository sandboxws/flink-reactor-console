/**
 * Route: /applications — Flink application list (Flink 2.3+, FLIP-549).
 *
 * The cluster→application→job hierarchy is only present on Flink 2.3+ clusters
 * running in application mode; on older clusters the backend returns an empty
 * list, so this page renders an explanatory empty state rather than an error.
 */
import { createFileRoute } from "@tanstack/react-router"
import { Layers } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  type Application,
  cancelApplication,
  fetchApplications,
} from "@/lib/graphql-api-client"
import { useClusterStore } from "@/stores/cluster-store"

export const Route = createFileRoute("/applications/")({
  component: ApplicationsPage,
})

function ApplicationsPage() {
  const [apps, setApps] = useState<Application[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Application mode (FLIP-549) is a Flink 2.3+ capability. Gate the whole
  // page on it so older clusters get a clear explanation instead of a
  // pointless empty fetch against an endpoint they don't implement.
  const capabilities = useClusterStore((s) => s.overview?.capabilities)
  const supportsAppMode = (capabilities ?? []).includes("APPLICATION_MODE")

  const load = useCallback(() => {
    setError(null)
    fetchApplications()
      .then(setApps)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  useEffect(() => {
    if (supportsAppMode) load()
  }, [load, supportsAppMode])

  const handleCancel = async (id: string) => {
    await cancelApplication(id)
    load()
  }

  const count = apps?.length ?? 0

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Applications</h1>
        <span className="text-xs tabular-nums text-zinc-500">
          {count} {count === 1 ? "application" : "applications"}
        </span>
      </div>

      {!supportsAppMode ? (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-xs text-zinc-500">
          <Layers className="size-5" />
          Application mode requires a Flink 2.3+ cluster (FLIP-549).
        </div>
      ) : error ? (
        <div className="glass-card flex items-center justify-center py-16 text-xs text-job-failed">
          {error}
        </div>
      ) : !apps || apps.length === 0 ? (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-xs text-zinc-500">
          <Layers className="size-5" />
          No applications running on this cluster.
        </div>
      ) : (
        <div className="glass-card overflow-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-zinc-400">
              <tr>
                <th className="p-3 font-medium">Name</th>
                <th className="p-3 font-medium">State</th>
                <th className="p-3 font-medium">Jobs</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {apps.map((app) => (
                <tr key={app.id} className="border-dash-border border-t">
                  <td className="p-3 text-zinc-200">{app.name}</td>
                  <td className="p-3 text-zinc-300">{app.state}</td>
                  <td className="p-3 tabular-nums text-zinc-300">
                    {app.jobCount}
                  </td>
                  <td className="p-3 text-right">
                    <button
                      type="button"
                      onClick={() => handleCancel(app.id)}
                      className="rounded-md bg-job-failed/10 px-2 py-1 text-[11px] text-job-failed hover:bg-job-failed/20"
                    >
                      Cancel
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
