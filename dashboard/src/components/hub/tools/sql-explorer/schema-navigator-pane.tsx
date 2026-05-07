/**
 * SchemaNavigatorPane — right column of the SQL Explorer.
 *
 * Wraps the existing `<CatalogTreeBrowser>` from the Hub catalogs page.
 * On select, calls `onPick` with a fully-qualified table name so the
 * editor can insert it.
 */

import { useEffect, useState } from "react"
import { CatalogTreeBrowser } from "@/components/hub/data/catalog-tree-browser"
import { useCatalogStore } from "@/stores/catalog-store"

interface SchemaNavigatorPaneProps {
  onPick: (qualifiedName: string) => void
}

export function SchemaNavigatorPane({ onPick }: SchemaNavigatorPaneProps) {
  const initialize = useCatalogStore((s) => s.initialize)
  const catalogs = useCatalogStore((s) => s.catalogs)

  useEffect(() => {
    initialize()
  }, [initialize])

  const [selected, setSelected] = useState<{
    catalog: string
    database: string
    table: string
  } | null>(null)

  return (
    <div className="flex h-full min-h-0 flex-col border-l border-dash-border bg-dash-surface/30">
      <div className="flex h-10 shrink-0 items-center border-b border-dash-border px-4">
        <h3 className="font-mono text-[10.5px] uppercase tracking-wider text-fg-faint">
          Schema navigator
        </h3>
        <span className="ml-auto font-mono text-[10px] text-fg-faint">
          {catalogs.length} catalog{catalogs.length === 1 ? "" : "s"}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        <CatalogTreeBrowser
          selected={selected}
          onSelect={(sel) => {
            setSelected(sel)
            if (sel.table) {
              onPick(`\`${sel.catalog}\`.\`${sel.database}\`.\`${sel.table}\``)
            }
          }}
        />
      </div>
    </div>
  )
}
