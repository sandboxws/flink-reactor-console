/**
 * 3-level catalog tree (catalog → database → table).
 *
 * Uses the `.file-tree-row` primitive. Expansion state is persisted in
 * `useUiStore.catalogTreeExpanded` so navigating away and back preserves
 * which nodes are expanded. Lazy-loads database/table lists from
 * `useCatalogStore`.
 *
 * Catalog folder color is derived from `connectorType` (paimon = coral,
 * fluss = teal, hive = violet, jdbc = rose, default = amber) to match
 * the mockup's visual hierarchy.
 *
 * `filter`, when non-empty, filters tables by case-insensitive substring
 * match on table name within each opened database. Catalogs and
 * databases are always shown.
 */

import {
  ChevronDown,
  ChevronRight,
  Database,
  Folder,
  FolderOpen,
  Table,
} from "lucide-react"
import { useCatalogStore } from "@/stores/catalog-store"
import { useUiStore } from "@/stores/ui-store"

interface CatalogTreeBrowserProps {
  selected: { catalog: string; database: string; table: string } | null
  onSelect: (sel: { catalog: string; database: string; table: string }) => void
  /** Optional table-name filter (case-insensitive substring). */
  filter?: string
}

/** Catalog folder color resolver. Static lookup so Tailwind's static
 *  scanner sees full utility class strings. */
function catalogIconClass(connectorType: string): string {
  const t = connectorType.toLowerCase()
  if (t.includes("paimon")) return "text-fr-coral"
  if (t.includes("fluss")) return "text-fr-teal"
  if (t.includes("hive")) return "text-fr-purple"
  if (t.includes("jdbc")) return "text-fr-rose"
  if (t.includes("iceberg")) return "text-fr-sage"
  return "text-fr-amber"
}

export function CatalogTreeBrowser({
  selected,
  onSelect,
  filter,
}: CatalogTreeBrowserProps) {
  const catalogs = useCatalogStore((s) => s.catalogs)
  const databases = useCatalogStore((s) => s.databases)
  const tables = useCatalogStore((s) => s.tables)
  const loadingNodes = useCatalogStore((s) => s.loadingNodes)
  const toggleNode = useCatalogStore((s) => s.toggleNode)
  const expanded = useUiStore((s) => s.catalogTreeExpanded)
  const toggleExpand = useUiStore((s) => s.toggleCatalogTreeNode)

  const filterLower = filter?.trim().toLowerCase() ?? ""

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
        const iconClass = catalogIconClass(c.connectorType ?? "")
        const FolderIcon = cOpen ? FolderOpen : Folder
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
                <ChevronDown className="size-3 text-fg-faint" />
              ) : (
                <ChevronRight className="size-3 text-fg-faint" />
              )}
              <FolderIcon className={`size-3.5 ${iconClass}`} />
              <span className="font-mono text-[12.5px]">{c.name}</span>
              <span className="ml-auto font-mono text-[10px] text-fg-faint">
                {c.databaseCount} db{c.databaseCount === 1 ? "" : "s"}
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
                        className="file-tree-row w-full pl-5 text-left"
                        onClick={() => {
                          toggleExpand(dbKey)
                          toggleNode(dbKey, c.name, db.name)
                        }}
                        aria-expanded={dbOpen}
                      >
                        {dbOpen ? (
                          <ChevronDown className="size-3 text-fg-faint" />
                        ) : (
                          <ChevronRight className="size-3 text-fg-faint" />
                        )}
                        <Database className="size-3.5 text-fr-amber" />
                        <span className="font-mono">{db.name}</span>
                      </button>
                      {dbOpen
                        ? (tables[dbKey] ?? [])
                            .filter(
                              (t) =>
                                filterLower === "" ||
                                t.name.toLowerCase().includes(filterLower),
                            )
                            .map((t) => {
                              const tKey = `${dbKey}/${t.name}`
                              const isSelected =
                                selected?.catalog === c.name &&
                                selected?.database === db.name &&
                                selected?.table === t.name
                              return (
                                <button
                                  key={tKey}
                                  type="button"
                                  className={`file-tree-row w-full pl-10 text-left ${isSelected ? "active" : ""}`}
                                  onClick={() =>
                                    onSelect({
                                      catalog: c.name,
                                      database: db.name,
                                      table: t.name,
                                    })
                                  }
                                >
                                  <Table
                                    className={`size-3.5 ${isSelected ? "text-fr-coral" : "text-fr-sage"}`}
                                  />
                                  <span
                                    className={`font-mono text-[12px] ${isSelected ? "text-fr-coral" : "text-fg"}`}
                                  >
                                    {t.name}
                                  </span>
                                </button>
                              )
                            })
                        : null}
                      {dbOpen && loadingNodes.has(dbKey) ? (
                        <p className="pl-10 font-mono text-[10px] text-fg-faint">
                          loading…
                        </p>
                      ) : null}
                    </div>
                  )
                })
              : null}
            {cOpen && loadingNodes.has(cKey) ? (
              <p className="pl-5 font-mono text-[10px] text-fg-faint">
                loading…
              </p>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
