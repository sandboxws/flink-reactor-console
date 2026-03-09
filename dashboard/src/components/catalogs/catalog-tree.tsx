import {
  ChevronDown,
  ChevronRight,
  Columns3,
  Database,
  Folder,
  Loader2,
  Table2,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { useCatalogStore } from "@/stores/catalog-store"

export function CatalogTree() {
  const catalogs = useCatalogStore((s) => s.catalogs)
  const expandedNodes = useCatalogStore((s) => s.expandedNodes)
  const databases = useCatalogStore((s) => s.databases)
  const tables = useCatalogStore((s) => s.tables)
  const columns = useCatalogStore((s) => s.columns)
  const loadingNodes = useCatalogStore((s) => s.loadingNodes)
  const toggleNode = useCatalogStore((s) => s.toggleNode)

  if (catalogs.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500">
        No catalogs found
      </div>
    )
  }

  return (
    <div className="space-y-0.5">
      {catalogs.map((catalog) => {
        const catalogKey = catalog.name
        const isExpanded = expandedNodes.has(catalogKey)
        const isLoading = loadingNodes.has(catalogKey)
        const catalogDbs = databases[catalogKey] ?? []

        return (
          <div key={catalogKey}>
            <TreeButton
              icon={Database}
              label={catalog.name}
              badge={catalog.source === "bundled" ? "(example)" : undefined}
              expanded={isExpanded}
              loading={isLoading}
              depth={0}
              onClick={() => toggleNode(catalogKey, catalog.name)}
            />
            {isExpanded && (
              <div>
                {isLoading &&
                catalogDbs.length === 0 ? null : catalogDbs.length === 0 ? (
                  <div className="pl-8 py-1 text-[10px] text-zinc-600">
                    No databases
                  </div>
                ) : (
                  catalogDbs.map((db) => {
                    const dbKey = `${catalog.name}.${db.name}`
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
                          depth={1}
                          onClick={() =>
                            toggleNode(dbKey, catalog.name, db.name)
                          }
                        />
                        {isDbExpanded && (
                          <div>
                            {isDbLoading &&
                            dbTables.length === 0 ? null : dbTables.length ===
                              0 ? (
                              <div className="pl-14 py-1 text-[10px] text-zinc-600">
                                No tables
                              </div>
                            ) : (
                              dbTables.map((table) => {
                                const tableKey = `${catalog.name}.${db.name}.${table.name}`
                                const isTableExpanded =
                                  expandedNodes.has(tableKey)
                                const isTableLoading =
                                  loadingNodes.has(tableKey)
                                const tableCols = columns[tableKey] ?? []

                                return (
                                  <div key={tableKey}>
                                    <TreeButton
                                      icon={Table2}
                                      label={table.name}
                                      expanded={isTableExpanded}
                                      loading={isTableLoading}
                                      depth={2}
                                      onClick={() =>
                                        toggleNode(
                                          tableKey,
                                          catalog.name,
                                          db.name,
                                          table.name,
                                        )
                                      }
                                    />
                                    {isTableExpanded && (
                                      <div>
                                        {isTableLoading &&
                                        tableCols.length ===
                                          0 ? null : tableCols.length === 0 ? (
                                          <div className="pl-[5.5rem] py-1 text-[10px] text-zinc-600">
                                            No columns
                                          </div>
                                        ) : (
                                          tableCols.map((col) => (
                                            <div
                                              key={col.name}
                                              className="flex items-center gap-2 py-0.5 pl-[5.5rem] text-xs text-zinc-400"
                                            >
                                              <Columns3 className="size-3 shrink-0 text-zinc-600" />
                                              <span className="truncate font-mono text-[10px]">
                                                {col.name}
                                              </span>
                                              <span className="shrink-0 font-mono text-[10px] text-zinc-600">
                                                {col.type}
                                              </span>
                                            </div>
                                          ))
                                        )}
                                      </div>
                                    )}
                                  </div>
                                )
                              })
                            )}
                          </div>
                        )}
                      </div>
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

function TreeButton({
  icon: Icon,
  label,
  badge,
  expanded,
  loading,
  depth,
  onClick,
}: {
  icon: typeof Database
  label: string
  badge?: string
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
        depth === 2 && "pl-14",
      )}
    >
      {loading ? (
        <Loader2 className="size-3 shrink-0 animate-spin text-zinc-500" />
      ) : expanded ? (
        <ChevronDown className="size-3 shrink-0 text-zinc-500" />
      ) : (
        <ChevronRight className="size-3 shrink-0 text-zinc-500" />
      )}
      <Icon className="size-3.5 shrink-0 text-zinc-500" />
      <span className="truncate font-mono text-[11px]">{label}</span>
      {badge && (
        <span className="shrink-0 text-[9px] text-zinc-600">{badge}</span>
      )}
    </button>
  )
}
