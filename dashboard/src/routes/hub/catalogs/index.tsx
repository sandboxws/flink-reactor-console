/**
 * Hub catalogs — /hub/catalogs.
 *
 * Mirrors `console-v2/catalogs.html` exactly: page header with breadcrumb
 * (extending into the selected table), title, summary stats, and action
 * buttons; 2-pane workspace below with a filterable tree on the left and
 * a tabbed table-detail pane on the right (header card with KPIs, then
 * Schema / DDL / Sample-data tabs).
 *
 * Tree expansion state is persisted in `useUiStore` so navigating to
 * a table detail and back keeps the previously-open nodes expanded.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, Link } from "@tanstack/react-router"
import { FolderTree, Plus, RotateCw, Search, SearchCode } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { CatalogTableDetail } from "@/components/hub/data/catalog-table-detail"
import { CatalogTreeBrowser } from "@/components/hub/data/catalog-tree-browser"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useCatalogStore } from "@/stores/catalog-store"

interface Selection {
  catalog: string
  database: string
  table: string
}

function HubCatalogs() {
  const fetchCatalogs = useCatalogStore((s) => s.fetchCatalogs)
  const fetchTableDDL = useCatalogStore((s) => s.fetchTableDDL)
  const toggleNode = useCatalogStore((s) => s.toggleNode)
  const catalogs = useCatalogStore((s) => s.catalogs)
  const columnsMap = useCatalogStore((s) => s.columns)
  const ddlMap = useCatalogStore((s) => s.ddl)
  const loading = useCatalogStore((s) => s.loading)

  const [selected, setSelected] = useState<Selection | null>(null)
  const [filter, setFilter] = useState("")

  useEffect(() => {
    fetchCatalogs()
  }, [fetchCatalogs])

  // When a table is selected, ensure its column metadata + DDL are loaded.
  useEffect(() => {
    if (!selected) return
    const colKey = `${selected.catalog}/${selected.database}/${selected.table}/columns`
    if (!columnsMap[colKey]) {
      toggleNode(colKey, selected.catalog, selected.database, selected.table)
    }
    fetchTableDDL(selected.catalog, selected.database, selected.table)
  }, [selected, toggleNode, fetchTableDDL, columnsMap])

  const columns = useMemo(() => {
    if (!selected) return []
    const colKey = `${selected.catalog}/${selected.database}/${selected.table}/columns`
    return columnsMap[colKey] ?? []
  }, [selected, columnsMap])

  const ddl = useMemo(() => {
    if (!selected) return undefined
    const ddlKey = `${selected.catalog}.${selected.database}.${selected.table}`
    return ddlMap[ddlKey]
  }, [selected, ddlMap])

  const selectedCatalog = useMemo(() => {
    if (!selected) return undefined
    return catalogs.find((c) => c.name === selected.catalog)
  }, [selected, catalogs])

  const totalDatabases = useMemo(
    () => catalogs.reduce((sum, c) => sum + c.databaseCount, 0),
    [catalogs],
  )
  const totalTables = useMemo(
    () => catalogs.reduce((sum, c) => sum + c.tableCount, 0),
    [catalogs],
  )

  const breadcrumb = selected
    ? [
        { label: "Data" },
        { label: "Catalogs" },
        { label: `${selected.catalog}.${selected.database}`, mono: true },
        { label: selected.table, mono: true },
      ]
    : [{ label: "Data" }, { label: "Catalogs" }]

  return (
    <HubAppShell>
      <HubBreadcrumb crumbs={breadcrumb} LinkComponent={HubLink} />

      <div className="mt-1 mb-5 flex items-end justify-between gap-4">
        <div>
          <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
            Catalog browser
          </h1>
          <p className="mt-0.5 text-[12px] text-fg-muted">
            {loading && catalogs.length === 0
              ? "loading…"
              : `${catalogs.length} catalog${catalogs.length === 1 ? "" : "s"} · ${totalDatabases} database${totalDatabases === 1 ? "" : "s"} · ${totalTables} table${totalTables === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => fetchCatalogs()}
            className="btn btn-secondary btn-sm"
          >
            <RotateCw className="size-3.5" />
            Refresh
          </button>
          <Link to="/hub/sql-explorer" className="btn btn-secondary btn-sm">
            <SearchCode className="size-3.5" />
            Open in SQL
          </Link>
          <button
            type="button"
            disabled
            className="btn btn-primary btn-sm"
            title="Catalog creation lands in a follow-up"
          >
            <Plus className="size-3.5" />
            New catalog
          </button>
        </div>
      </div>

      <section className="grid grid-cols-12 gap-5">
        {/* Tree pane */}
        <div className="col-span-12 lg:col-span-4 xl:col-span-3">
          <div className="glass-card-static overflow-hidden">
            <div className="flex items-center gap-2 border-b border-dash-border px-3 py-2">
              <Search className="size-3.5 text-fg-muted" />
              <input
                type="text"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Filter tables…"
                className="flex-1 bg-transparent font-mono text-[12px] text-fg outline-none placeholder:text-fg-faint"
              />
              <span className="font-mono text-[10px] text-fg-faint">
                {totalTables}
              </span>
            </div>
            <div className="max-h-[72vh] overflow-y-auto p-2">
              <CatalogTreeBrowser
                selected={selected}
                onSelect={setSelected}
                filter={filter}
              />
            </div>
          </div>
        </div>

        {/* Detail pane */}
        <div className="col-span-12 lg:col-span-8 xl:col-span-9">
          {selected ? (
            <CatalogTableDetail
              selected={selected}
              catalog={selectedCatalog}
              columns={columns}
              ddl={ddl}
            />
          ) : (
            <EmptyState />
          )}
        </div>
      </section>
    </HubAppShell>
  )
}

function EmptyState() {
  return (
    <div className="glass-card-static flex h-full min-h-[320px] flex-col items-center justify-center gap-3 p-10 text-center">
      <FolderTree className="size-8 text-fr-coral/60" />
      <div>
        <h3 className="font-sans text-[14px] font-medium text-zinc-100">
          Pick a table to inspect
        </h3>
        <p className="mt-1 max-w-sm text-[12px] text-fg-muted">
          Expand a catalog and database in the tree to see its tables. Selecting
          a table shows its schema, DDL, and sample-data shortcut.
        </p>
      </div>
    </div>
  )
}

export const Route = createFileRoute("/hub/catalogs/")({
  component: HubCatalogs,
})
