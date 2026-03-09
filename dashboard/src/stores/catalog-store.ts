import { create } from "zustand"
import {
  type CatalogDatabase,
  type CatalogInfo,
  type CatalogTable,
  type ColumnInfo,
  fetchCatalogColumns,
  fetchCatalogDatabases,
  fetchCatalogs,
  fetchCatalogTables,
} from "@/lib/graphql-api-client"

interface CatalogState {
  catalogs: CatalogInfo[]
  loading: boolean
  error: string | null

  // Per-node expanded state and children
  expandedNodes: Set<string>
  databases: Record<string, CatalogDatabase[]>
  tables: Record<string, CatalogTable[]>
  columns: Record<string, ColumnInfo[]>
  loadingNodes: Set<string>
}

interface CatalogActions {
  fetchCatalogs: () => Promise<void>
  toggleNode: (
    nodeKey: string,
    catalog: string,
    database?: string,
    table?: string,
  ) => void
}

export type CatalogStore = CatalogState & CatalogActions

export const useCatalogStore = create<CatalogStore>((set, get) => ({
  catalogs: [],
  loading: false,
  error: null,
  expandedNodes: new Set(),
  databases: {},
  tables: {},
  columns: {},
  loadingNodes: new Set(),

  fetchCatalogs: async () => {
    set({ loading: true, error: null })
    try {
      const data = await fetchCatalogs()
      set({ catalogs: data, loading: false })
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : "Failed to load catalogs",
        loading: false,
      })
    }
  },

  toggleNode: async (
    nodeKey: string,
    catalog: string,
    database?: string,
    table?: string,
  ) => {
    const { expandedNodes, loadingNodes } = get()

    if (expandedNodes.has(nodeKey)) {
      const next = new Set(expandedNodes)
      next.delete(nodeKey)
      set({ expandedNodes: next })
      return
    }

    // Expand and lazy-load children
    const nextExpanded = new Set(expandedNodes)
    nextExpanded.add(nodeKey)
    const nextLoading = new Set(loadingNodes)
    nextLoading.add(nodeKey)
    set({ expandedNodes: nextExpanded, loadingNodes: nextLoading })

    try {
      if (database && table) {
        // Loading columns for a table
        const data = await fetchCatalogColumns(catalog, database, table)
        set((s) => {
          const next = new Set(s.loadingNodes)
          next.delete(nodeKey)
          return {
            columns: { ...s.columns, [nodeKey]: data },
            loadingNodes: next,
          }
        })
      } else if (database) {
        // Loading tables for a database
        const data = await fetchCatalogTables(catalog, database)
        set((s) => {
          const next = new Set(s.loadingNodes)
          next.delete(nodeKey)
          return {
            tables: { ...s.tables, [nodeKey]: data },
            loadingNodes: next,
          }
        })
      } else {
        // Loading databases for a catalog
        const data = await fetchCatalogDatabases(catalog)
        set((s) => {
          const next = new Set(s.loadingNodes)
          next.delete(nodeKey)
          return {
            databases: { ...s.databases, [nodeKey]: data },
            loadingNodes: next,
          }
        })
      }
    } catch (err) {
      set((s) => {
        const next = new Set(s.loadingNodes)
        next.delete(nodeKey)
        return {
          error:
            err instanceof Error ? err.message : "Failed to load catalog data",
          loadingNodes: next,
        }
      })
    }
  },
}))
