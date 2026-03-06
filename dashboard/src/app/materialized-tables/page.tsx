"use client"

import { useEffect } from "react"
import { MaterializedTablesTable } from "@/components/materialized-tables/materialized-tables-table"
import { useMaterializedTableStore } from "@/stores/materialized-table-store"

export default function MaterializedTablesPage() {
  const tables = useMaterializedTableStore((s) => s.tables)
  const isLoading = useMaterializedTableStore((s) => s.isLoading)
  const fetchError = useMaterializedTableStore((s) => s.fetchError)
  const fetchTables = useMaterializedTableStore((s) => s.fetchTables)

  useEffect(() => {
    fetchTables()
  }, [fetchTables])

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">
          Materialized Tables
        </h1>
        <span className="text-xs tabular-nums text-zinc-500">
          {tables.length} {tables.length === 1 ? "table" : "tables"}
        </span>
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs text-red-400">
          {fetchError}
        </div>
      )}

      {isLoading && tables.length === 0 ? (
        <div className="flex items-center justify-center py-16 text-zinc-500">
          <span className="text-sm">Loading materialized tables...</span>
        </div>
      ) : (
        <div className="glass-card overflow-hidden">
          <MaterializedTablesTable tables={tables} />
        </div>
      )}
    </div>
  )
}
