import { Layers, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchFlussDatabases, fetchFlussTables } from "@/lib/instruments/api"
import type { FlussTableSummary } from "@/lib/instruments/types"
import { FLUSS_TABLE_TYPE_BADGE, formatLastUpdated } from "./lib"

type LinkProps = {
  to: string
  search?: Record<string, string>
  className?: string
  children: React.ReactNode
}

// FlussTableBrowser renders a two-pane browser: databases on the left,
// tables for the selected database on the right. Each table row shows the
// PrimaryKey/Log badge, bucket count, primary key columns, and last-updated.
export function FlussTableBrowser({
  instrumentName,
  LinkComponent,
}: {
  instrumentName: string
  LinkComponent: React.ComponentType<LinkProps>
}) {
  const [databases, setDatabases] = useState<string[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [tables, setTables] = useState<FlussTableSummary[]>([])
  const [loadingDB, setLoadingDB] = useState(true)
  const [loadingTables, setLoadingTables] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoadingDB(true)
    fetchFlussDatabases(instrumentName)
      .then((dbs) => {
        setDatabases(dbs)
        setError(null)
        if (dbs.length > 0) setSelected(dbs[0])
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoadingDB(false))
  }, [instrumentName])

  useEffect(() => {
    if (!selected) {
      setTables([])
      return
    }
    setLoadingTables(true)
    fetchFlussTables(instrumentName, selected)
      .then((data) => {
        setTables(data)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoadingTables(false))
  }, [instrumentName, selected])

  if (loadingDB) {
    return (
      <div className="glass-card flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return <div className="glass-card p-4 text-sm text-job-failed">{error}</div>
  }

  if (databases.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-2 p-8 text-center">
        <Layers className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">
          No databases in this Fluss cluster
        </p>
      </div>
    )
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[220px_1fr]">
      <aside className="glass-card divide-y divide-dash-border">
        {databases.map((db) => (
          <button
            key={db}
            type="button"
            onClick={() => setSelected(db)}
            className={`block w-full px-3 py-2 text-left text-sm font-mono ${
              selected === db
                ? "bg-white/[0.06] text-fr-coral"
                : "text-zinc-300 hover:bg-white/[0.02]"
            }`}
          >
            {db}
          </button>
        ))}
      </aside>

      <section className="glass-card overflow-hidden">
        {loadingTables ? (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="size-4 animate-spin text-zinc-500" />
          </div>
        ) : tables.length === 0 ? (
          <div className="p-6 text-center text-sm text-zinc-500">
            No tables in {selected}
          </div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border text-left text-zinc-500">
                <th className="px-3 py-2 font-medium">Table</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Buckets</th>
                <th className="px-3 py-2 font-medium">Primary key</th>
                <th className="px-3 py-2 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dash-border">
              {tables.map((t) => (
                <tr
                  key={`${t.database}.${t.name}`}
                  className="hover:bg-white/[0.02]"
                >
                  <td className="px-3 py-1.5">
                    <LinkComponent
                      to={`/instruments/${instrumentName}/fluss/table`}
                      search={{ database: t.database, table: t.name }}
                      className="font-mono text-zinc-200 hover:text-fr-coral"
                    >
                      {t.name}
                    </LinkComponent>
                  </td>
                  <td className="px-3 py-1.5">
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        FLUSS_TABLE_TYPE_BADGE[t.tableType] ??
                        "bg-white/[0.08] text-zinc-300"
                      }`}
                    >
                      {t.tableType}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-zinc-400">
                    {t.bucketCount}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-zinc-500">
                    {t.primaryKey?.length ? t.primaryKey.join(", ") : "—"}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-500">
                    {formatLastUpdated(t.lastUpdatedMs)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  )
}
