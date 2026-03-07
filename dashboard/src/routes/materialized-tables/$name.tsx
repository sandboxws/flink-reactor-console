import { createFileRoute } from "@tanstack/react-router"
import { Pause, Play, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { RefreshStatusBadge } from "@/components/materialized-tables/refresh-status-badge"
import { useMaterializedTableStore } from "@/stores/materialized-table-store"

type MaterializedTableSearch = {
  catalog?: string
}

export const Route = createFileRoute("/materialized-tables/$name")({
  validateSearch: (
    search: Record<string, unknown>,
  ): MaterializedTableSearch => ({
    catalog: (search.catalog as string) || undefined,
  }),
  component: MaterializedTableDetail,
})

function PropRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-300">{value}</span>
    </div>
  )
}

function MaterializedTableDetail() {
  const { name } = Route.useParams()
  const { catalog = "" } = Route.useSearch()

  const table = useMaterializedTableStore((s) => s.selectedTable)
  const isLoading = useMaterializedTableStore((s) => s.selectedTableLoading)
  const error = useMaterializedTableStore((s) => s.selectedTableError)
  const fetchTable = useMaterializedTableStore((s) => s.fetchTable)
  const suspendTable = useMaterializedTableStore((s) => s.suspendTable)
  const resumeTable = useMaterializedTableStore((s) => s.resumeTable)
  const refreshTable = useMaterializedTableStore((s) => s.refreshTable)

  useEffect(() => {
    if (name && catalog) {
      fetchTable(decodeURIComponent(name), catalog)
    }
  }, [fetchTable, name, catalog])

  if (isLoading && !table) {
    return (
      <div className="flex items-center justify-center py-16 text-zinc-500">
        <span className="text-sm">Loading materialized table...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4">
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      </div>
    )
  }

  if (!table) return null

  const decodedName = decodeURIComponent(name)

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-semibold text-zinc-100">{table.name}</h1>
          <RefreshStatusBadge status={table.refreshStatus} />
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          {table.refreshStatus === "ACTIVATED" && (
            <button
              type="button"
              onClick={() => suspendTable(decodedName, catalog)}
              className="flex items-center gap-1.5 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-medium text-amber-400 transition-colors hover:bg-amber-500/20"
            >
              <Pause className="size-3" />
              Suspend
            </button>
          )}
          {table.refreshStatus === "SUSPENDED" && (
            <button
              type="button"
              onClick={() => resumeTable(decodedName, catalog)}
              className="flex items-center gap-1.5 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/20"
            >
              <Play className="size-3" />
              Resume
            </button>
          )}
          <button
            type="button"
            onClick={() => refreshTable(decodedName, catalog)}
            className="flex items-center gap-1.5 rounded-md border border-dash-border bg-dash-surface px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-dash-panel"
          >
            <RefreshCw className="size-3" />
            Refresh
          </button>
        </div>
      </div>

      {/* Properties */}
      <div className="glass-card p-4">
        <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
          Properties
        </h2>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="space-y-2">
            <PropRow label="Catalog" value={table.catalog} />
            <PropRow label="Database" value={table.database || "-"} />
            <PropRow label="Refresh Mode" value={table.refreshMode ?? "-"} />
          </div>
          <div className="space-y-2">
            <PropRow label="Freshness" value={table.freshness ?? "-"} />
          </div>
        </div>
      </div>

      {/* Defining query */}
      {table.definingQuery && (
        <div className="glass-card p-4">
          <h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-zinc-500">
            Defining Query
          </h2>
          <pre className="overflow-x-auto rounded-md bg-dash-surface p-3 font-mono text-xs leading-relaxed text-zinc-300">
            {table.definingQuery}
          </pre>
        </div>
      )}
    </div>
  )
}
