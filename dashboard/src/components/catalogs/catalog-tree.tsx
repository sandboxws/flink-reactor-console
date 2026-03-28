/**
 * @module catalog-tree
 *
 * Database/table tree for a single catalog. Used as the middle panel in the
 * three-panel catalog browser. Lazy-loads databases on mount and tables when
 * a database is expanded. Calls `onSelectTable` when a table row is clicked.
 */

import { Spinner } from "@flink-reactor/ui"
import {
  ChevronDown,
  ChevronRight,
  Folder,
  Table2,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { useCatalogStore } from "@/stores/catalog-store"

/**
 * Tree showing databases > tables for a single catalog.
 *
 * When `catalogName` is provided, shows that catalog's databases as root nodes.
 * When omitted, falls back to showing all catalogs (backward compat).
 * `onSelectTable` fires when a table row is clicked.
 */
export function CatalogTree({
  catalogName,
  selectedTable,
  onSelectTable,
}: {
  catalogName: string
  selectedTable?: string | null
  onSelectTable?: (catalog: string, database: string, table: string) => void
}) {
  const expandedNodes = useCatalogStore((s) => s.expandedNodes)
  const databases = useCatalogStore((s) => s.databases)
  const tables = useCatalogStore((s) => s.tables)
  const loadingNodes = useCatalogStore((s) => s.loadingNodes)
  const toggleNode = useCatalogStore((s) => s.toggleNode)

  const catalogDbs = databases[catalogName] ?? []
  const isLoading = loadingNodes.has(catalogName)

  if (isLoading && catalogDbs.length === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <Spinner size="sm" />
      </div>
    )
  }

  if (catalogDbs.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-600">
        No databases
      </div>
    )
  }

  return (
    <div className="space-y-0.5 p-1">
      {catalogDbs.map((db) => {
        const dbKey = `${catalogName}.${db.name}`
        const isDbExpanded = expandedNodes.has(dbKey)
        const isDbLoading = loadingNodes.has(dbKey)
        const dbTables = tables[dbKey] ?? []

        return (
          <div key={dbKey}>
            <TreeButton
              icon={Folder}
              label={db.name}
              expanded={isDbExpanded}
              loading={isDbLoading}
              depth={0}
              onClick={() => toggleNode(dbKey, catalogName, db.name)}
            />
            {isDbExpanded && (
              <div>
                {isDbLoading && dbTables.length === 0 ? null : dbTables.length ===
                  0 ? (
                  <div className="py-1 pl-8 text-[10px] text-zinc-600">
                    No tables
                  </div>
                ) : (
                  dbTables.map((table) => {
                    const tableKey = `${catalogName}.${db.name}.${table.name}`
                    const isSelected = selectedTable === tableKey

                    return (
                      <button
                        key={tableKey}
                        type="button"
                        onClick={() =>
                          onSelectTable?.(catalogName, db.name, table.name)
                        }
                        className={cn(
                          "flex w-full items-center gap-2 rounded-md px-2 py-1.5 pl-8 text-xs transition-colors",
                          isSelected
                            ? "bg-white/[0.06] text-zinc-100"
                            : "text-zinc-400 hover:bg-white/[0.03] hover:text-zinc-300",
                        )}
                      >
                        <Table2 className="size-3 shrink-0 text-zinc-500" />
                        <span className="truncate font-mono text-[11px]">
                          {table.name}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Indented tree row button with expand/collapse chevron, icon, and label. */
function TreeButton({
  icon: Icon,
  label,
  expanded,
  loading,
  depth,
  onClick,
}: {
  icon: typeof Folder
  label: string
  expanded: boolean
  loading: boolean
  depth: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-white/[0.04]",
        depth === 1 && "pl-8",
      )}
    >
      {loading ? (
        <Spinner size="sm" className="shrink-0" />
      ) : expanded ? (
        <ChevronDown className="size-3 shrink-0 text-zinc-500" />
      ) : (
        <ChevronRight className="size-3 shrink-0 text-zinc-500" />
      )}
      <Icon className="size-3.5 shrink-0 text-zinc-500" />
      <span className="truncate font-mono text-[11px]">{label}</span>
    </button>
  )
}
