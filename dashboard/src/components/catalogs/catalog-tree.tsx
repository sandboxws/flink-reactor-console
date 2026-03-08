import {
  ChevronDown,
  ChevronRight,
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
                              dbTables.map((table) => (
                                <div
                                  key={table.name}
                                  className="flex items-center gap-2 py-1 pl-14 text-xs text-zinc-400"
                                >
                                  <Table2 className="size-3 shrink-0 text-zinc-600" />
                                  <span className="truncate font-mono text-[11px]">
                                    {table.name}
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
      })}
    </div>
  )
}

function TreeButton({
  icon: Icon,
  label,
  expanded,
  loading,
  depth,
  onClick,
}: {
  icon: typeof Database
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
        <Loader2 className="size-3 shrink-0 animate-spin text-zinc-500" />
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
