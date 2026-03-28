/**
 * Catalog store — tree browser for Flink SQL catalogs, databases, tables, and columns.
 *
 * Lazy-loads children on node expansion: catalogs → databases → tables → columns.
 * Tracks expanded/loading state per tree node using composite key strings.
 *
 * @module catalog-store
 */

import { create } from "zustand"
import {
  type CatalogDatabase,
  type CatalogInfo,
  type CatalogTable,
  type ColumnInfo,
  fetchCatalogColumns,
  fetchCatalogDatabases,
  fetchCatalogs,
  fetchCatalogTableDDL,
  fetchCatalogTables,
} from "@/lib/graphql-api-client"

interface CatalogState {
  /** Top-level catalogs returned by the GraphQL API. */
  catalogs: CatalogInfo[]
  /** Whether the catalog list is loading. */
  loading: boolean
  /** Error from the most recent catalog operation. */
  error: string | null

  /** Set of expanded tree node keys. */
  expandedNodes: Set<string>
  /** Databases per catalog node key. */
  databases: Record<string, CatalogDatabase[]>
  /** Tables per database node key. */
  tables: Record<string, CatalogTable[]>
  /** Columns per table node key. */
  columns: Record<string, ColumnInfo[]>
  /** DDL per table node key. */
  ddl: Record<string, string>
  /** Set of node keys currently being fetched. */
  loadingNodes: Set<string>
}

interface CatalogActions {
  /** Fetch the top-level catalog list. */
  fetchCatalogs: () => Promise<void>
  /** Toggle a tree node: collapse if expanded, or expand and lazy-load children. */
  toggleNode: (
    nodeKey: string,
    catalog: string,
    database?: string,
    table?: string,
  ) => void
  /** Fetch DDL for a table (if not already cached). */
  fetchTableDDL: (catalog: string, database: string, table: string) => Promise<void>
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
  ddl: {},
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

  fetchTableDDL: async (catalog: string, database: string, table: string) => {
    const key = `${catalog}.${database}.${table}`
    if (get().ddl[key] !== undefined) return
    try {
      const ddl = await fetchCatalogTableDDL(catalog, database, table)
      set((s) => ({ ddl: { ...s.ddl, [key]: ddl } }))
    } catch {
      // DDL fetch is supplementary — don't block the UI
    }
  },
}))
