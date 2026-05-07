/**
 * 3-level catalog tree (catalog → database → table) **grouped by
 * connector type**.
 *
 * Catalogs are bucketed under `Paimon`, `Fluss`, `Iceberg`, `JDBC`,
 * `Hive`, `Other` headers (each header sourced from `c.connectorType`)
 * so a workspace with mixed sources shows the structure at a glance —
 * matching `console-v2/catalogs.html`'s visual hierarchy.
 *
 * Nesting is indented with wrapper margins (`ml-3` per level) instead
 * of left-padding on the rows themselves; this matches the mockup and
 * makes the tree obviously hierarchical at a glance.
 *
 * Tables are capped at `TABLE_COLLAPSED_LIMIT` per database with a
 * "… N more" expander row so a database with hundreds of tables doesn't
 * blow up the sidebar. Click the expander to render the full list;
 * the expansion state is local (per-render, not persisted).
 *
 * `filter`, when non-empty, filters tables by case-insensitive substring
 * match on table name within each opened database. Catalogs and
 * databases are always shown. When a filter is active the truncation
 * cap is lifted so all matching tables are visible.
 */

import {
  ChevronDown,
  ChevronRight,
  Database,
  Folder,
  FolderOpen,
  MoreHorizontal,
  Table,
} from "lucide-react"
import { useMemo, useState } from "react"
import type { CatalogInfo } from "@/lib/graphql-api-client"
import { useCatalogStore } from "@/stores/catalog-store"
import { useUiStore } from "@/stores/ui-store"

interface CatalogTreeBrowserProps {
  selected: { catalog: string; database: string; table: string } | null
  onSelect: (sel: { catalog: string; database: string; table: string }) => void
  /** Optional table-name filter (case-insensitive substring). */
  filter?: string
}

/** How many tables per database to render before showing "… N more". */
const TABLE_COLLAPSED_LIMIT = 8

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

/** Group catalogs by connector type. Returns an array of [groupName,
 *  catalogs[]] pairs in a stable display order. */
function groupCatalogsBySource(
  catalogs: CatalogInfo[],
): Array<{ label: string; key: string; items: CatalogInfo[] }> {
  const buckets = new Map<string, { label: string; items: CatalogInfo[] }>()
  for (const c of catalogs) {
    const raw = (c.connectorType || "other").trim()
    const key = raw.toLowerCase() || "other"
    const label = prettyConnectorLabel(raw)
    const bucket = buckets.get(key)
    if (bucket) bucket.items.push(c)
    else buckets.set(key, { label, items: [c] })
  }
  // Stable ordering: Paimon first, then Fluss, Iceberg, JDBC, Hive, others A-Z.
  const order = ["paimon", "fluss", "iceberg", "jdbc", "hive"]
  const ordered: Array<{ label: string; key: string; items: CatalogInfo[] }> =
    []
  for (const k of order) {
    const b = buckets.get(k)
    if (b) {
      ordered.push({ key: k, label: b.label, items: b.items })
      buckets.delete(k)
    }
  }
  const remaining = Array.from(buckets.entries())
    .sort((a, b) => a[1].label.localeCompare(b[1].label))
    .map(([key, b]) => ({ key, label: b.label, items: b.items }))
  return [...ordered, ...remaining]
}

/** Convert a raw connectorType string ("paimon", "JDBC", etc.) into a
 *  display label. Uppercases known acronyms; title-cases the rest. */
function prettyConnectorLabel(raw: string): string {
  const lower = raw.toLowerCase()
  if (lower === "jdbc") return "JDBC"
  if (lower === "hive") return "Hive"
  if (lower === "other" || raw === "") return "Other"
  return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase()
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
  const filterActive = filterLower !== ""

  /** Per-database keys whose table list is forced "show all" by the user
   *  clicking "… N more". */
  const [expandedTableLists, setExpandedTableLists] = useState<Set<string>>(
    () => new Set(),
  )

  const groups = useMemo(() => groupCatalogsBySource(catalogs), [catalogs])

  if (catalogs.length === 0) {
    return (
      <p className="text-[11px] font-mono text-fg-faint">
        No catalogs registered.
      </p>
    )
  }

  return (
    <div className="space-y-4 text-[12px]">
      {groups.map((group) => (
        <section key={group.key}>
          <h4 className="mb-1.5 px-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            {group.label}
            <span className="ml-1.5 text-fg-faint/70">
              · {group.items.length}
            </span>
          </h4>
          <div className="space-y-0.5">
            {group.items.map((c) => {
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
                    <span className="font-mono text-[12.5px] text-fg">
                      {c.name}
                    </span>
                    <span className="ml-auto font-mono text-[10px] text-fg-faint">
                      {c.databaseCount} db{c.databaseCount === 1 ? "" : "s"}
                    </span>
                  </button>
                  {cOpen ? (
                    <div className="mt-0.5 ml-3 border-l border-dash-border/40 pl-2">
                      {(databases[cKey] ?? []).map((db) => {
                        const dbKey = `${cKey}/${db.name}`
                        const dbOpen = expanded[dbKey] ?? false
                        const showAll =
                          expandedTableLists.has(dbKey) || filterActive
                        const allTables = (tables[dbKey] ?? []).filter(
                          (t) =>
                            !filterActive ||
                            t.name.toLowerCase().includes(filterLower),
                        )
                        const visible = showAll
                          ? allTables
                          : allTables.slice(0, TABLE_COLLAPSED_LIMIT)
                        const hidden = allTables.length - visible.length
                        return (
                          <div key={dbKey}>
                            <button
                              type="button"
                              className="file-tree-row w-full text-left"
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
                              <span className="font-mono text-fg">
                                {db.name}
                              </span>
                            </button>
                            {dbOpen ? (
                              <div className="mt-0.5 ml-3 border-l border-dash-border/40 pl-2">
                                {visible.map((t) => {
                                  const tKey = `${dbKey}/${t.name}`
                                  const isSelected =
                                    selected?.catalog === c.name &&
                                    selected?.database === db.name &&
                                    selected?.table === t.name
                                  return (
                                    <button
                                      key={tKey}
                                      type="button"
                                      className={`file-tree-row w-full text-left ${isSelected ? "active" : ""}`}
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
                                        className={`truncate font-mono text-[12px] ${isSelected ? "text-fr-coral" : "text-fg"}`}
                                      >
                                        {t.name}
                                      </span>
                                    </button>
                                  )
                                })}
                                {hidden > 0 ? (
                                  <button
                                    type="button"
                                    className="file-tree-row w-full text-left"
                                    onClick={() =>
                                      setExpandedTableLists((prev) => {
                                        const next = new Set(prev)
                                        next.add(dbKey)
                                        return next
                                      })
                                    }
                                  >
                                    <MoreHorizontal className="size-3.5 text-fg-faint" />
                                    <span className="font-mono text-[11px] text-fg-faint">
                                      … {hidden} more table
                                      {hidden === 1 ? "" : "s"}
                                    </span>
                                  </button>
                                ) : null}
                                {showAll &&
                                allTables.length > TABLE_COLLAPSED_LIMIT &&
                                !filterActive ? (
                                  <button
                                    type="button"
                                    className="file-tree-row w-full text-left"
                                    onClick={() =>
                                      setExpandedTableLists((prev) => {
                                        const next = new Set(prev)
                                        next.delete(dbKey)
                                        return next
                                      })
                                    }
                                  >
                                    <ChevronDown className="size-3 rotate-180 text-fg-faint" />
                                    <span className="font-mono text-[11px] text-fg-faint">
                                      Show fewer
                                    </span>
                                  </button>
                                ) : null}
                                {visible.length === 0 &&
                                allTables.length === 0 &&
                                !loadingNodes.has(dbKey) ? (
                                  <p className="px-2 py-1 font-mono text-[10.5px] text-fg-faint">
                                    {filterActive
                                      ? "no tables match"
                                      : "empty database"}
                                  </p>
                                ) : null}
                                {loadingNodes.has(dbKey) ? (
                                  <p className="px-2 py-1 font-mono text-[10px] text-fg-faint">
                                    loading…
                                  </p>
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                      {loadingNodes.has(cKey) ? (
                        <p className="px-2 py-1 font-mono text-[10px] text-fg-faint">
                          loading…
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
