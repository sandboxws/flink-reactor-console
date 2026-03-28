/**
 * @module catalog-browser-page
 *
 * Three-panel catalog browser: catalog sidebar | database/table tree | column detail.
 * Uses resizable panels so the user can adjust proportions. Selecting a catalog
 * loads its databases in the middle panel; selecting a table shows columns in
 * the content panel.
 */

import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
  Spinner,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import { AlertTriangle, Code2, Database, RefreshCw, Table2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { cn } from "@/lib/cn"
import { useCatalogStore } from "@/stores/catalog-store"
import { CatalogItem } from "./catalog-card"
import { CatalogTree } from "./catalog-tree"
import { ColumnsTable } from "./columns-table"
import { SqlHighlight } from "./sql-highlight"

/**
 * Three-panel catalog browser page. Fetches catalogs on mount.
 *
 * Layout: [Catalogs sidebar] | [Database/table tree] | [Column detail]
 */
export function CatalogBrowserPage() {
  const loading = useCatalogStore((s) => s.loading)
  const error = useCatalogStore((s) => s.error)
  const catalogs = useCatalogStore((s) => s.catalogs)
  const fetchCatalogs = useCatalogStore((s) => s.fetchCatalogs)
  const toggleNode = useCatalogStore((s) => s.toggleNode)
  const expandedNodes = useCatalogStore((s) => s.expandedNodes)
  const columns = useCatalogStore((s) => s.columns)
  const ddl = useCatalogStore((s) => s.ddl)
  const fetchTableDDL = useCatalogStore((s) => s.fetchTableDDL)
  const loadingNodes = useCatalogStore((s) => s.loadingNodes)

  const [selectedCatalog, setSelectedCatalog] = useState<string | null>(null)
  const [selectedTable, setSelectedTable] = useState<{
    catalog: string
    database: string
    table: string
    key: string
  } | null>(null)

  useEffect(() => {
    fetchCatalogs()
  }, [fetchCatalogs])

  const handleSelectCatalog = useCallback(
    (catalogName: string) => {
      setSelectedCatalog(catalogName)
      setSelectedTable(null)
      // Auto-expand databases if not already loaded
      if (!expandedNodes.has(catalogName)) {
        toggleNode(catalogName, catalogName)
      }
    },
    [expandedNodes, toggleNode],
  )

  const handleSelectTable = useCallback(
    (catalog: string, database: string, table: string) => {
      const key = `${catalog}.${database}.${table}`
      setSelectedTable({ catalog, database, table, key })
      // Load columns if not already loaded
      if (!columns[key] && !loadingNodes.has(key)) {
        toggleNode(key, catalog, database, table)
      }
      // Fetch DDL in background
      fetchTableDDL(catalog, database, table)
    },
    [columns, loadingNodes, toggleNode, fetchTableDDL],
  )

  const tableCols = selectedTable ? columns[selectedTable.key] : null
  const tableDdl = selectedTable ? ddl[selectedTable.key] : undefined
  const tableLoading = selectedTable
    ? loadingNodes.has(selectedTable.key)
    : false

  return (
    <div className="flex h-full flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-dash-border px-4 py-2">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-zinc-400" />
          <h1 className="text-sm font-medium text-zinc-200">
            Available Catalogs
          </h1>
          {catalogs.length > 0 && (
            <span className="text-xs text-zinc-600">
              ({catalogs.length})
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={fetchCatalogs}
          disabled={loading}
          className={cn(
            "flex items-center gap-1.5 rounded-md border border-dash-border px-2.5 py-1 text-xs text-zinc-400 transition-colors",
            "hover:bg-white/[0.04] hover:text-zinc-300",
            "disabled:opacity-50",
          )}
        >
          <RefreshCw className={cn("size-3", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="border-b border-job-failed/20 bg-job-failed/5 px-4 py-2 text-xs text-job-failed">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-1 items-center justify-center">
          <Spinner size="lg" />
        </div>
      )}

      {/* Three-panel layout */}
      {!loading && (
        <ResizablePanelGroup orientation="horizontal" className="flex-1">
          {/* Panel 1: Catalog list */}
          <ResizablePanel defaultSize="15%" minSize={180} maxSize="35%">
            <div className="flex h-full flex-col overflow-hidden">
              <div className="border-b border-dash-border px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  Catalogs
                </span>
              </div>
              <div className="flex-1 overflow-y-auto p-1">
                {catalogs.length === 0 ? (
                  <div className="p-4 text-center text-xs text-zinc-600">
                    No catalogs found
                  </div>
                ) : (
                  catalogs.map((catalog) => (
                    <CatalogItem
                      key={catalog.name}
                      catalog={catalog}
                      selected={selectedCatalog === catalog.name}
                      onClick={() => handleSelectCatalog(catalog.name)}
                    />
                  ))
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Panel 2: Database/table tree */}
          <ResizablePanel defaultSize="15%" minSize={180} maxSize="40%">
            <div className="flex h-full flex-col overflow-hidden">
              <div className="border-b border-dash-border px-3 py-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  {selectedCatalog ? (
                    <>
                      Tables —{" "}
                      <span className="normal-case text-zinc-400">
                        {selectedCatalog}
                      </span>
                    </>
                  ) : (
                    "Tables"
                  )}
                </span>
              </div>
              <div className="flex-1 overflow-y-auto">
                {selectedCatalog ? (
                  <CatalogTree
                    catalogName={selectedCatalog}
                    selectedTable={selectedTable?.key}
                    onSelectTable={handleSelectTable}
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 p-8 text-zinc-600">
                    <Database className="size-6 text-zinc-700" />
                    <span className="text-xs">Select a catalog</span>
                  </div>
                )}
              </div>
            </div>
          </ResizablePanel>

          <ResizableHandle />

          {/* Panel 3: Table detail with tabs */}
          <ResizablePanel defaultSize="70%" minSize="25%">
            <div className="flex h-full flex-col overflow-hidden">
              {selectedTable ? (
                <Tabs defaultValue="columns" className="flex h-full flex-col">
                  <div className="flex items-center gap-3 border-b border-dash-border px-3">
                    <span className="font-mono text-[11px] text-zinc-400">
                      {selectedTable.catalog}.{selectedTable.database}.
                      <span className="text-zinc-200">
                        {selectedTable.table}
                      </span>
                    </span>
                    <TabsList className="detail-tabs-list">
                      <TabsTrigger value="columns" className="detail-tab">
                        Columns
                      </TabsTrigger>
                      <TabsTrigger value="ddl" className="detail-tab">
                        <Code2 className="mr-1 size-3" />
                        DDL
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent
                    value="columns"
                    className="flex-1 overflow-y-auto p-2 data-[state=inactive]:hidden"
                  >
                    {tableLoading && (
                      <div className="flex items-center justify-center p-8">
                        <Spinner size="sm" />
                      </div>
                    )}
                    {!tableLoading && tableCols && tableCols.length > 0 && (
                      <ColumnsTable columns={tableCols} />
                    )}
                    {!tableLoading && tableCols && tableCols.length === 0 && (
                      <div className="p-8 text-center text-xs text-zinc-600">
                        No columns
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent
                    value="ddl"
                    className="flex-1 overflow-y-auto p-2 data-[state=inactive]:hidden"
                  >
                    {tableDdl !== undefined ? (
                      tableDdl ? (
                        <SqlHighlight
                          code={tableDdl}
                          className="rounded-md border border-dash-border bg-dash-surface/50 p-4 text-xs [&_pre]:!bg-transparent"
                        />
                      ) : (
                        <div className="p-8 text-center text-xs text-zinc-600">
                          No DDL available
                        </div>
                      )
                    ) : (
                      <div className="flex items-center justify-center p-8">
                        <Spinner size="sm" />
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-zinc-600">
                  <Table2 className="size-6 text-zinc-700" />
                  <span className="text-xs">
                    Select a table to view its schema
                  </span>
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      )}
    </div>
  )
}
