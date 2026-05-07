/**
 * FlussTableBrowser — Fluss instrument browser.
 *
 * Two-column layout: database list (left) and tables in the active
 * database (right) with summary metadata (bucket count, primary key,
 * last-updated). Clicking a table navigates to the table detail route
 * via search params.
 */

import { Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { Database } from "lucide-react"
import { useEffect, useState } from "react"
import {
  type FlussTableSummary,
  fetchFlussDatabases,
  fetchFlussTables,
} from "@/lib/instruments-data"

interface FlussTableBrowserProps {
  instrument: string
}

export function FlussTableBrowser({ instrument }: FlussTableBrowserProps) {
  const [databases, setDatabases] = useState<string[] | null>(null)
  const [activeDb, setActiveDb] = useState<string | null>(null)
  const [tables, setTables] = useState<FlussTableSummary[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFlussDatabases(instrument)
      .then((list) => {
        if (cancelled) return
        setDatabases(list)
        if (list.length > 0) setActiveDb(list[0])
        else setActiveDb(null)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load databases")
        setDatabases([])
      })
    return () => {
      cancelled = true
    }
  }, [instrument])

  useEffect(() => {
    if (!activeDb) {
      setTables([])
      return
    }
    let cancelled = false
    setTables(null)
    fetchFlussTables(instrument, activeDb)
      .then((list) => {
        if (!cancelled) setTables(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load tables")
          setTables([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [instrument, activeDb])

  return (
    <div className="grid grid-cols-12 gap-5">
      <aside className="col-span-12 lg:col-span-3">
        <div className="glass-card-static p-4">
          <h3 className="section-heading mb-3">Databases</h3>
          {databases === null ? (
            <p className="text-[11px] font-mono text-fg-faint">Loading…</p>
          ) : databases.length === 0 ? (
            <p className="text-[11px] font-mono text-fg-faint">No databases.</p>
          ) : (
            <ul className="space-y-1">
              {databases.map((db) => (
                <li key={db}>
                  <button
                    type="button"
                    onClick={() => setActiveDb(db)}
                    className={
                      "file-tree-row w-full text-left " +
                      (db === activeDb ? "active" : "")
                    }
                  >
                    <Database className="size-3.5 text-fr-coral" />
                    <span className="font-mono text-[12px] truncate">{db}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      <section className="col-span-12 lg:col-span-9">
        <div className="glass-card-static overflow-hidden">
          <div className="flex items-center justify-between border-b border-dash-border px-4 py-3">
            <h3 className="section-heading">
              Tables{" "}
              {activeDb ? <span className="text-fg">· {activeDb}</span> : null}
            </h3>
            <span className="font-mono text-[10px] text-fg-faint">
              {tables ? `${tables.length} tables` : ""}
            </span>
          </div>
          {error ? (
            <p className="px-4 py-3 text-[11.5px] text-fr-rose">{error}</p>
          ) : null}
          {tables === null ? (
            <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
              Loading tables…
            </p>
          ) : tables.length === 0 ? (
            <p className="px-4 py-3 text-[11.5px] font-mono text-fg-faint">
              No tables in this database.
            </p>
          ) : (
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-dash-border text-left text-fg-faint">
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Name
                  </th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Buckets
                  </th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Primary key
                  </th>
                  <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border/40">
                {tables.map((t) => (
                  <tr
                    key={`${t.database}.${t.name}`}
                    className="hover:bg-dash-elevated/30"
                  >
                    <td className="px-4 py-2 font-mono text-fg">
                      <Link
                        to="/hub/instruments/$instrumentName/fluss/table"
                        params={{ instrumentName: instrument }}
                        search={{ database: t.database, table: t.name }}
                        className="text-fr-coral hover:underline"
                      >
                        {t.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 font-mono text-fg-muted">
                      {t.tableType}
                    </td>
                    <td className="px-4 py-2 font-mono text-fg-muted">
                      {t.bucketCount}
                    </td>
                    <td className="px-4 py-2 font-mono text-[11px] text-fg-muted truncate max-w-[200px]">
                      {t.primaryKey.length > 0 ? t.primaryKey.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-2 font-mono text-[10.5px] text-fg-faint">
                      {t.lastUpdatedMs
                        ? format(new Date(t.lastUpdatedMs), "MMM d HH:mm")
                        : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  )
}
