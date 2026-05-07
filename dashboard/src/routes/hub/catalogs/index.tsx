/**
 * Hub catalogs — /hub/catalogs.
 *
 * Mirrors `console-v2/catalogs.html`: 3-pane file-tree browser (catalogs →
 * databases → tables) on the left, schema preview in the center, and a
 * sample-rows / DDL placeholder on the right. Tree expansion state is
 * persisted in `useUiStore` so navigating to a table detail and back keeps
 * the previously-open nodes expanded.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute } from "@tanstack/react-router"
import { useEffect, useMemo, useState } from "react"
import { CatalogTreeBrowser } from "@/components/hub/data/catalog-tree-browser"
import { SchemaPreview } from "@/components/hub/data/schema-preview"
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

  const [selected, setSelected] = useState<Selection | null>(null)

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
    const ddlKey = `${selected.catalog}/${selected.database}/${selected.table}`
    return ddlMap[ddlKey]
  }, [selected, ddlMap])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Data" }, { label: "Catalogs" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          Catalogs
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          {catalogs.length} catalog{catalogs.length === 1 ? "" : "s"} · expand a
          node to lazy-load its children
        </p>
      </div>

      <div className="grid grid-cols-12 gap-5">
        {/* Tree */}
        <aside className="col-span-12 lg:col-span-3">
          <div className="glass-card-static p-4">
            <CatalogTreeBrowser selected={selected} onSelect={setSelected} />
          </div>
        </aside>

        {/* Schema preview */}
        <main className="col-span-12 lg:col-span-5">
          <div className="glass-card-static p-5">
            <SchemaPreview selected={selected} columns={columns} ddl={ddl} />
          </div>
        </main>

        {/* Sample rows / actions */}
        <aside className="col-span-12 lg:col-span-4">
          <div className="glass-card-static p-5">
            <h3 className="section-heading mb-3">Sample rows</h3>
            {selected ? (
              <p className="text-[11px] font-mono text-fg-faint">
                Sample rows wire up via the SQL Gateway —{" "}
                <code>
                  SELECT * FROM {selected.catalog}.{selected.database}.
                  {selected.table} LIMIT 50
                </code>{" "}
                in the SQL explorer.
              </p>
            ) : (
              <p className="text-[11px] font-mono text-fg-faint">
                Select a table in the tree to preview rows.
              </p>
            )}
          </div>
        </aside>
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/catalogs/")({
  component: HubCatalogs,
})
