import { cn } from "@flink-reactor/ui"
import { ChevronRight, Database, Eye, Loader2, Table2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import {
  fetchDatabaseSchemas,
  fetchDatabaseTables,
} from "@/lib/instruments/api"
import type {
  DatabaseSchema,
  DatabaseTableSummary,
} from "@/lib/instruments/types"

export function SchemaBrowser({
  instrumentName,
  LinkComponent,
}: {
  instrumentName: string
  LinkComponent: React.ComponentType<{
    to: string
    search?: Record<string, string>
    className?: string
    children: React.ReactNode
  }>
}) {
  const [schemas, setSchemas] = useState<DatabaseSchema[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSchema, setExpandedSchema] = useState<string | null>(null)
  const [tables, setTables] = useState<DatabaseTableSummary[]>([])
  const [tablesLoading, setTablesLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    fetchDatabaseSchemas(instrumentName)
      .then((data) => {
        setSchemas(data)
        setError(null)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [instrumentName])

  const toggleSchema = useCallback(
    (schemaName: string) => {
      if (expandedSchema === schemaName) {
        setExpandedSchema(null)
        setTables([])
        return
      }
      setExpandedSchema(schemaName)
      setTablesLoading(true)
      fetchDatabaseTables(instrumentName, schemaName)
        .then((data) => setTables(data))
        .catch(() => setTables([]))
        .finally(() => setTablesLoading(false))
    },
    [instrumentName, expandedSchema],
  )

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return <div className="glass-card p-4 text-sm text-job-failed">{error}</div>
  }

  if (schemas.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-2 p-8 text-center">
        <Database className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">No schemas found</p>
      </div>
    )
  }

  return (
    <div className="glass-card divide-y divide-dash-border">
      {schemas.map((schema) => (
        <div key={schema.name}>
          <button
            type="button"
            onClick={() => toggleSchema(schema.name)}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-white/[0.03]"
          >
            <ChevronRight
              className={cn(
                "size-3.5 text-zinc-500 transition-transform",
                expandedSchema === schema.name && "rotate-90",
              )}
            />
            <Database className="size-3.5 text-zinc-400" />
            <span className="font-medium text-zinc-200">{schema.name}</span>
            <span className="ml-auto text-xs text-zinc-600">
              {schema.tableCount} table{schema.tableCount !== 1 ? "s" : ""}
            </span>
          </button>

          {expandedSchema === schema.name && (
            <div className="border-t border-dash-border bg-white/[0.01]">
              {tablesLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="size-4 animate-spin text-zinc-500" />
                </div>
              ) : tables.length === 0 ? (
                <div className="px-6 py-3 text-xs text-zinc-600">No tables</div>
              ) : (
                tables.map((table) => (
                  <LinkComponent
                    key={table.name}
                    to={`/instruments/${instrumentName}/database/table`}
                    search={{ schema: schema.name, table: table.name }}
                    className="flex items-center gap-2 px-6 py-1.5 text-sm transition-colors hover:bg-white/[0.03]"
                  >
                    {table.type === "VIEW" ? (
                      <Eye className="size-3 text-zinc-500" />
                    ) : (
                      <Table2 className="size-3 text-zinc-500" />
                    )}
                    <span className="text-zinc-300">{table.name}</span>
                    <span className="ml-auto text-xs text-zinc-600">
                      ~{table.rowCountEstimate.toLocaleString()} rows
                    </span>
                  </LinkComponent>
                ))
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
