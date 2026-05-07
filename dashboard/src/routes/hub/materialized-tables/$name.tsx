/**
 * Hub materialized table detail — /hub/materialized-tables/$name.
 *
 * Three sections: status header (with suspend/resume/refresh action buttons),
 * the SQL defining query in a `.code-viewer`, and a placeholder refresh
 * history. The `?catalog=...` search param is required because table names
 * are unique within a catalog but not across catalogs.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams, useSearch } from "@tanstack/react-router"
import { Pause, Play, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import {
  getRefreshStatusColor,
  getRefreshStatusLabel,
} from "@/data/materialized-table-types"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useMaterializedTableStore } from "@/stores/materialized-table-store"

const COLOR_CLASSES = {
  green: "text-fr-sage bg-fr-sage/10 border-fr-sage/25",
  amber: "text-fr-amber bg-fr-amber/10 border-fr-amber/25",
  blue: "text-fr-teal bg-fr-teal/10 border-fr-teal/25",
} as const

type DetailSearch = {
  catalog?: string
}

function HubMaterializedTableDetail() {
  const { name } = useParams({ from: "/hub/materialized-tables/$name" })
  const { catalog } = useSearch({ from: "/hub/materialized-tables/$name" })

  const fetchTable = useMaterializedTableStore((s) => s.fetchTable)
  const suspendTable = useMaterializedTableStore((s) => s.suspendTable)
  const resumeTable = useMaterializedTableStore((s) => s.resumeTable)
  const refreshTable = useMaterializedTableStore((s) => s.refreshTable)
  const table = useMaterializedTableStore((s) => s.selectedTable)
  const loading = useMaterializedTableStore((s) => s.selectedTableLoading)
  const error = useMaterializedTableStore((s) => s.selectedTableError)

  useEffect(() => {
    if (catalog) fetchTable(name, catalog)
  }, [name, catalog, fetchTable])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Materialized tables", to: "/hub/materialized-tables" },
          { label: name, mono: true },
        ]}
        LinkComponent={HubLink}
      />

      {!catalog ? (
        <div className="glass-card-static mt-4 p-6 text-center text-[12px] text-fg-muted">
          Missing <code className="font-mono">?catalog=</code> search parameter.
          Navigate from the list to load this table.
        </div>
      ) : error ? (
        <div className="glass-card-static mt-4 p-6 text-center text-[12px] text-fr-rose">
          {error}
        </div>
      ) : loading || !table ? (
        <div className="glass-card-static mt-4 p-6 text-center text-[12px] text-fg-muted">
          Loading…
        </div>
      ) : (
        <>
          <div className="mt-1 mb-6 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
                {table.name}
              </h1>
              <p className="mt-0.5 text-[12px] font-mono text-fg-muted">
                {table.catalog}.{table.database}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={`label-chip border text-[11px] ${COLOR_CLASSES[getRefreshStatusColor(table.refreshStatus)]}`}
              >
                {getRefreshStatusLabel(table.refreshStatus)}
              </span>
              {table.refreshStatus === "ACTIVATED" ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => suspendTable(table.name, table.catalog)}
                >
                  <Pause />
                  Suspend
                </button>
              ) : (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => resumeTable(table.name, table.catalog)}
                >
                  <Play />
                  Resume
                </button>
              )}
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => refreshTable(table.name, table.catalog)}
              >
                <RefreshCw />
                Refresh now
              </button>
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
            <KvCard label="Refresh mode" value={table.refreshMode ?? "—"} />
            <KvCard label="Freshness" value={table.freshness ?? "—"} />
            <KvCard label="Database" value={table.database} />
          </section>

          <section className="glass-card-static p-5 mb-5">
            <h3 className="section-heading mb-3">Defining query</h3>
            {table.definingQuery ? (
              <pre className="code-viewer text-[12px] font-mono whitespace-pre-wrap">
                {table.definingQuery}
              </pre>
            ) : (
              <p className="text-[11px] font-mono text-fg-faint">
                No defining query recorded.
              </p>
            )}
          </section>

          <section className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Refresh history</h3>
            <p className="text-[11px] font-mono text-fg-faint">
              Refresh history wires up when the materialized-table audit log
              endpoint lands.
            </p>
          </section>
        </>
      )}
    </HubAppShell>
  )
}

function KvCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="font-mono text-[13px] text-fg truncate">{value}</div>
    </div>
  )
}

export const Route = createFileRoute("/hub/materialized-tables/$name")({
  validateSearch: (search: Record<string, unknown>): DetailSearch => ({
    catalog: typeof search.catalog === "string" ? search.catalog : undefined,
  }),
  component: HubMaterializedTableDetail,
})
