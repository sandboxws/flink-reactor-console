/**
 * Route: /applications/$id — Flink application detail (Flink 2.3+, FLIP-549).
 *
 * Reached from the Applications list. Shows the application's identity, state,
 * start time and job count, with a Cancel action. Gated on the cluster's
 * APPLICATION_MODE capability like the list page.
 */
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router"
import { ArrowLeft, Layers } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  type Application,
  cancelApplication,
  fetchApplication,
} from "@/lib/graphql-api-client"
import { useClusterStore } from "@/stores/cluster-store"

export const Route = createFileRoute("/applications/$id")({
  component: ApplicationDetailPage,
})

function formatStartTime(startTime: string | null): string {
  if (!startTime) return "—"
  const ms = Number(startTime)
  if (!Number.isFinite(ms) || ms <= 0) return "—"
  return new Date(ms).toLocaleString()
}

function ApplicationDetailPage() {
  const { id } = Route.useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState<Application | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const capabilities = useClusterStore((s) => s.overview?.capabilities)
  const supportsAppMode = (capabilities ?? []).includes("APPLICATION_MODE")

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    fetchApplication(id)
      .then(setApp)
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false))
  }, [id])

  useEffect(() => {
    if (supportsAppMode) load()
  }, [load, supportsAppMode])

  const handleCancel = async () => {
    await cancelApplication(id)
    navigate({ to: "/applications" })
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <Link
        to="/applications"
        className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300"
      >
        <ArrowLeft className="size-3.5" />
        Applications
      </Link>

      {!supportsAppMode ? (
        <div className="glass-card flex flex-col items-center justify-center gap-2 py-16 text-xs text-zinc-500">
          <Layers className="size-5" />
          Application mode requires a Flink 2.3+ cluster (FLIP-549).
        </div>
      ) : error ? (
        <div className="glass-card flex items-center justify-center py-16 text-xs text-job-failed">
          {error}
        </div>
      ) : loading || !app ? (
        <div className="glass-card flex items-center justify-center py-16 text-xs text-zinc-500">
          {loading ? "Loading…" : `Application "${id}" not found.`}
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-zinc-100">
                {app.name}
              </h1>
              <p className="mt-0.5 font-mono text-xs text-zinc-500">{app.id}</p>
            </div>
            <button
              type="button"
              onClick={handleCancel}
              className="rounded-md bg-job-failed/10 px-3 py-1.5 text-[11px] text-job-failed hover:bg-job-failed/20"
            >
              Cancel application
            </button>
          </div>

          <div className="glass-card grid grid-cols-1 gap-px overflow-hidden sm:grid-cols-3">
            <Field label="State" value={app.state} />
            <Field label="Jobs" value={String(app.jobCount)} />
            <Field label="Started" value={formatStartTime(app.startTime)} />
          </div>
        </>
      )}
    </div>
  )
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-dash-panel p-3">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-xs text-zinc-200">{value}</div>
    </div>
  )
}
