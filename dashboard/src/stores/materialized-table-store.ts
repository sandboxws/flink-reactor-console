import { gql } from "urql"
import { create } from "zustand"
import { mapMaterializedTables } from "@/data/materialized-table-mappers"
import type { MaterializedTable } from "@flink-reactor/ui"
import { graphqlClient } from "@/lib/graphql-client"

/**
 * Materialized table store — CRUD operations for Flink materialized tables.
 *
 * Fetches the table list and detail via GraphQL, and supports suspend, resume,
 * and refresh mutations. Maps raw GraphQL responses to domain types via
 * {@link mapMaterializedTables}.
 *
 * @module materialized-table-store
 */

interface MaterializedTableState {
  /** All known materialized tables. */
  tables: MaterializedTable[]
  /** Whether the table list is loading. */
  isLoading: boolean
  /** Error from the most recent list fetch. */
  fetchError: string | null
  /** Lazily loaded detail for the selected table. */
  selectedTable: MaterializedTable | null
  /** Whether a table detail fetch is in progress. */
  selectedTableLoading: boolean
  /** Error from the most recent detail fetch. */
  selectedTableError: string | null
}

interface MaterializedTableActions {
  /** Fetch all materialized tables, optionally filtered by cluster and catalog. */
  fetchTables: (cluster?: string, catalog?: string) => Promise<void>
  /** Fetch detail for a single table by name and catalog. */
  fetchTable: (name: string, catalog: string, cluster?: string) => Promise<void>
  /** Suspend a materialized table's refresh schedule. */
  suspendTable: (
    name: string,
    catalog: string,
    cluster?: string,
  ) => Promise<void>
  /** Resume a suspended materialized table's refresh schedule. */
  resumeTable: (
    name: string,
    catalog: string,
    cluster?: string,
  ) => Promise<void>
  /** Trigger an immediate refresh of a materialized table. */
  refreshTable: (
    name: string,
    catalog: string,
    cluster?: string,
  ) => Promise<void>
}

type MaterializedTableStore = MaterializedTableState & MaterializedTableActions

const TABLES_QUERY = gql`
  query MaterializedTables($cluster: String, $catalog: String) {
    materializedTables(cluster: $cluster, catalog: $catalog) {
      name
      catalog
      database
      refreshStatus
      refreshMode
      freshness
      definingQuery
    }
  }
`

const TABLE_DETAIL_QUERY = gql`
  query MaterializedTableDetail(
    $name: String!
    $catalog: String!
    $cluster: String
  ) {
    materializedTable(name: $name, catalog: $catalog, cluster: $cluster) {
      name
      catalog
      database
      refreshStatus
      refreshMode
      freshness
      definingQuery
    }
  }
`

const SUSPEND_MUTATION = gql`
  mutation SuspendMaterializedTable(
    $name: String!
    $catalog: String!
    $cluster: String
  ) {
    suspendMaterializedTable(name: $name, catalog: $catalog, cluster: $cluster) {
      name
      catalog
      database
      refreshStatus
      refreshMode
      freshness
      definingQuery
    }
  }
`

const RESUME_MUTATION = gql`
  mutation ResumeMaterializedTable(
    $name: String!
    $catalog: String!
    $cluster: String
  ) {
    resumeMaterializedTable(name: $name, catalog: $catalog, cluster: $cluster) {
      name
      catalog
      database
      refreshStatus
      refreshMode
      freshness
      definingQuery
    }
  }
`

const REFRESH_MUTATION = gql`
  mutation RefreshMaterializedTable(
    $name: String!
    $catalog: String!
    $cluster: String
  ) {
    refreshMaterializedTable(
      name: $name
      catalog: $catalog
      cluster: $cluster
    ) {
      name
      catalog
      database
      refreshStatus
      refreshMode
      freshness
      definingQuery
    }
  }
`

export const useMaterializedTableStore = create<MaterializedTableStore>(
  (set) => ({
    tables: [],
    isLoading: false,
    fetchError: null,
    selectedTable: null,
    selectedTableLoading: false,
    selectedTableError: null,

    async fetchTables(cluster?: string, catalog?: string) {
      set({ isLoading: true, fetchError: null })
      try {
        const result = await graphqlClient
          .query(TABLES_QUERY, { cluster, catalog })
          .toPromise()
        if (result.error) throw result.error
        const raw = result.data?.materializedTables ?? []
        set({ tables: mapMaterializedTables(raw), isLoading: false })
      } catch (err) {
        set({
          fetchError:
            err instanceof Error
              ? err.message
              : "Failed to fetch materialized tables",
          isLoading: false,
        })
      }
    },

    async fetchTable(name: string, catalog: string, cluster?: string) {
      set({ selectedTableLoading: true, selectedTableError: null })
      try {
        const result = await graphqlClient
          .query(TABLE_DETAIL_QUERY, { name, catalog, cluster })
          .toPromise()
        if (result.error) throw result.error
        const raw = result.data?.materializedTable
        if (!raw) throw new Error(`Table "${name}" not found`)
        set({
          selectedTable: mapMaterializedTables([raw])[0],
          selectedTableLoading: false,
        })
      } catch (err) {
        set({
          selectedTableError:
            err instanceof Error ? err.message : "Failed to fetch table detail",
          selectedTableLoading: false,
        })
      }
    },

    async suspendTable(name: string, catalog: string, cluster?: string) {
      const result = await graphqlClient
        .mutation(SUSPEND_MUTATION, { name, catalog, cluster })
        .toPromise()
      if (result.error) throw result.error
      const raw = result.data?.suspendMaterializedTable
      if (raw) {
        set({ selectedTable: mapMaterializedTables([raw])[0] })
      }
    },

    async resumeTable(name: string, catalog: string, cluster?: string) {
      const result = await graphqlClient
        .mutation(RESUME_MUTATION, { name, catalog, cluster })
        .toPromise()
      if (result.error) throw result.error
      const raw = result.data?.resumeMaterializedTable
      if (raw) {
        set({ selectedTable: mapMaterializedTables([raw])[0] })
      }
    },

    async refreshTable(name: string, catalog: string, cluster?: string) {
      const result = await graphqlClient
        .mutation(REFRESH_MUTATION, { name, catalog, cluster })
        .toPromise()
      if (result.error) throw result.error
      const raw = result.data?.refreshMaterializedTable
      if (raw) {
        set({ selectedTable: mapMaterializedTables([raw])[0] })
      }
    },
  }),
)
