/**
 * Hub materialized tables list — /hub/materialized-tables.
 *
 * Mirrors `console-v2/materialized-tables.html`: filter rail + table list
 * with refresh status badges, refresh mode, and freshness columns. Each
 * row links to the detail route. Backed by `useMaterializedTableStore`.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { Filter, FlaskConical, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { MaterializedTableRow } from "@/components/hub/data/materialized-table-row"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useMaterializedTableStore } from "@/stores/materialized-table-store"

function HubMaterializedTables() {
  const fetchTables = useMaterializedTableStore((s) => s.fetchTables)
  const tables = useMaterializedTableStore((s) => s.tables)
  const isLoading = useMaterializedTableStore((s) => s.isLoading)
  const error = useMaterializedTableStore((s) => s.fetchError)
  const [search, setSearch] = useState("")

  // Listed from the default catalog: Apache Paimon's catalog does not implement
  // Flink's `SHOW MATERIALIZED TABLES`, so scoping the list to `paimon_catalog`
  // would surface a server error. Paimon materialized tables are created and
  // inspected (via SHOW TABLES / DESCRIBE / SELECT) on the Examples page.
  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  const filtered = useMemo(() => {
    if (!search) return tables
    const lower = search.toLowerCase()
    return tables.filter(
      (t) =>
        t.name.toLowerCase().includes(lower) ||
        t.catalog.toLowerCase().includes(lower) ||
        t.database.toLowerCase().includes(lower),
    )
  }, [tables, search])

  const counts = useMemo(() => {
    let activated = 0
    let suspended = 0
    let initializing = 0
    for (const t of tables) {
      if (t.refreshStatus === "ACTIVATED") activated++
      else if (t.refreshStatus === "SUSPENDED") suspended++
      else initializing++
    }
    return { activated, suspended, initializing }
  }, [tables])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Data" }, { label: "Materialized tables" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Materialized tables
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {tables.length} table{tables.length === 1 ? "" : "s"} ·{" "}
            {counts.activated} activated · {counts.suspended} suspended ·{" "}
            {counts.initializing} initializing
          </p>
        </div>
        <div className="flex items-center gap-2">
          <HubLink
            to="/hub/materialized-tables/explore"
            className="btn btn-secondary btn-sm"
          >
            <FlaskConical />
            Examples
          </HubLink>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => fetchTables()}
          >
            <RefreshCw />
            Refresh
          </button>
        </div>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 border-b border-dash-border pb-3">
        <div className="relative max-w-xs flex-1">
          <Filter
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-fg-faint size-4"
            aria-hidden="true"
          />
          <input
            type="text"
            placeholder="Filter by name, catalog, database..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input mono pl-8"
            style={{ height: 30, fontSize: 12 }}
          />
        </div>
      </div>

      {error ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fr-rose">
          Failed to load tables: {error}
        </div>
      ) : isLoading && tables.length === 0 ? (
        <div className="glass-card-static p-6 text-center text-[12px] text-fg-muted">
          Loading materialized tables…
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card-static p-12 text-center">
          <p className="text-[14px] font-medium text-zinc-100">
            {search ? "No matching tables" : "No materialized tables"}
          </p>
          <p className="mt-1 text-[12px] font-mono text-fg-muted">
            {search
              ? "Try a different filter term."
              : "Open Examples to create and explore materialized tables on the Paimon catalog."}
          </p>
        </div>
      ) : (
        <div className="glass-card-static overflow-hidden">
          <div className="grid grid-cols-[24px_1fr_120px_140px_120px_16px] gap-3 px-3 py-2 border-b border-dash-border bg-dash-surface/40 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
            <span></span>
            <span>Table</span>
            <span>Status</span>
            <span>Refresh mode</span>
            <span>Freshness</span>
            <span></span>
          </div>
          {filtered.map((t) => (
            <MaterializedTableRow key={t.name} table={t} />
          ))}
        </div>
      )}
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/materialized-tables/")({
  component: HubMaterializedTables,
})
