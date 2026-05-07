/**
 * 3-level catalog tree (catalog → database → table).
 *
 * Uses the `.file-tree-row` primitive. Expansion state is persisted in
 * `useUiStore.catalogTreeExpanded` so navigating away and back preserves
 * which nodes are expanded. Lazy-loads database/table lists from
 * `useCatalogStore`.
 */

import {
  ChevronDown,
  ChevronRight,
  Database,
  FolderOpen,
  Table,
} from "lucide-react"
import { useCatalogStore } from "@/stores/catalog-store"
import { useUiStore } from "@/stores/ui-store"

interface CatalogTreeBrowserProps {
  selected: { catalog: string; database: string; table: string } | null
  onSelect: (sel: { catalog: string; database: string; table: string }) => void
}

export function CatalogTreeBrowser({
  selected,
  onSelect,
}: CatalogTreeBrowserProps) {
  const catalogs = useCatalogStore((s) => s.catalogs)
  const databases = useCatalogStore((s) => s.databases)
  const tables = useCatalogStore((s) => s.tables)
  const loadingNodes = useCatalogStore((s) => s.loadingNodes)
  const toggleNode = useCatalogStore((s) => s.toggleNode)
  const expanded = useUiStore((s) => s.catalogTreeExpanded)
  const toggleExpand = useUiStore((s) => s.toggleCatalogTreeNode)

  if (catalogs.length === 0) {
    return (
      <p className="text-[11px] font-mono text-fg-faint">
        No catalogs registered.
      </p>
    )
  }

  return (
    <div className="space-y-0.5 text-[12px]">
      {catalogs.map((c) => {
        const cKey = c.name
        const cOpen = expanded[cKey] ?? false
        return (
          <div key={cKey}>
            <button
              type="button"
              className="file-tree-row w-full text-left"
              onClick={() => {
                toggleExpand(cKey)
                toggleNode(cKey, c.name)
              }}
              aria-expanded={cOpen}
            >
              {cOpen ? (
                <ChevronDown className="text-fg-faint size-3" />
              ) : (
                <ChevronRight className="text-fg-faint size-3" />
              )}
              <FolderOpen className="text-fr-amber size-3.5" />
              <span className="font-mono">{c.name}</span>
              <span className="ml-auto font-mono text-[10px] text-fg-faint">
                {c.databaseCount} dbs
              </span>
            </button>
            {cOpen
              ? (databases[cKey] ?? []).map((db) => {
                  const dbKey = `${cKey}/${db.name}`
                  const dbOpen = expanded[dbKey] ?? false
                  return (
                    <div key={dbKey}>
                      <button
                        type="button"
                        className="file-tree-row w-full text-left pl-5"
                        onClick={() => {
                          toggleExpand(dbKey)
                          toggleNode(dbKey, c.name, db.name)
                        }}
                        aria-expanded={dbOpen}
                      >
                        {dbOpen ? (
                          <ChevronDown className="text-fg-faint size-3" />
                        ) : (
                          <ChevronRight className="text-fg-faint size-3" />
                        )}
                        <Database className="text-fr-amber size-3.5" />
                        <span className="font-mono">{db.name}</span>
                      </button>
                      {dbOpen
                        ? (tables[dbKey] ?? []).map((t) => {
                            const tKey = `${dbKey}/${t.name}`
                            const isSelected =
                              selected?.catalog === c.name &&
                              selected?.database === db.name &&
                              selected?.table === t.name
                            return (
                              <button
                                key={tKey}
                                type="button"
                                className={`file-tree-row w-full text-left pl-10 ${isSelected ? "active" : ""}`}
                                onClick={() =>
                                  onSelect({
                                    catalog: c.name,
                                    database: db.name,
                                    table: t.name,
                                  })
                                }
                              >
                                <Table
                                  className={`size-3.5 ${isSelected ? "text-fr-coral" : "text-fg-faint"}`}
                                />
                                <span
                                  className={`font-mono ${isSelected ? "text-fr-coral" : "text-fg"}`}
                                >
                                  {t.name}
                                </span>
                              </button>
                            )
                          })
                        : null}
                      {dbOpen && loadingNodes.has(dbKey) ? (
                        <p className="pl-10 text-[10px] font-mono text-fg-faint">
                          loading…
                        </p>
                      ) : null}
                    </div>
                  )
                })
              : null}
            {cOpen && loadingNodes.has(cKey) ? (
              <p className="pl-5 text-[10px] font-mono text-fg-faint">
                loading…
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
