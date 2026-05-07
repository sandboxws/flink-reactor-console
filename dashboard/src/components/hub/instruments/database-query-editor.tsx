/**
 * DatabaseQueryEditor — read-only SQL editor with results table.
 *
 * Read-only at v1: only SELECT/EXPLAIN-style queries are allowed by the
 * backend (the resolver enforces this). Renders results as a paginated
 * table with column headers from the response.
 */

import { Play } from "lucide-react"
import { useState } from "react"
import {
  type DatabaseQueryResult,
  executeDatabaseQuery,
} from "@/lib/instruments-data"

interface DatabaseQueryEditorProps {
  instrument: string
  initialSql?: string
}

export function DatabaseQueryEditor({
  instrument,
  initialSql,
}: DatabaseQueryEditorProps) {
  const [sql, setSql] = useState(initialSql ?? "SELECT 1")
  const [result, setResult] = useState<DatabaseQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const run = async () => {
    if (!sql.trim()) return
    setLoading(true)
    setError(null)
    try {
      const r = await executeDatabaseQuery(instrument, sql)
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Query failed")
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="glass-card-static overflow-hidden">
        <div className="flex items-center justify-between border-b border-dash-border px-4 py-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            SQL (read-only)
          </span>
          <button
            type="button"
            onClick={run}
            disabled={loading || !sql.trim()}
            className="btn btn-secondary btn-sm"
          >
            <Play className="size-3" />
            {loading ? "Running…" : "Run"}
          </button>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          spellCheck={false}
          rows={6}
          className="w-full bg-transparent px-4 py-3 font-mono text-[12px] text-fg outline-none"
        />
      </div>

      {error ? (
        <div className="rounded-md border border-fr-rose/30 bg-fr-rose/5 px-3 py-2 font-mono text-[11.5px] text-fg">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="glass-card-static overflow-hidden">
          <div className="flex items-center justify-between border-b border-dash-border px-4 py-2 text-[10px] font-mono uppercase tracking-wider text-fg-faint">
            <span>
              {result.rowCount} rows · {result.executionTimeMs}ms
              {result.truncated ? " · truncated" : ""}
            </span>
            <span>{result.columns.length} cols</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="border-b border-dash-border text-left text-fg-faint">
                  {result.columns.map((c) => (
                    <th
                      key={c.name}
                      className="px-3 py-2 font-mono text-[10px] uppercase tracking-wider"
                    >
                      {c.name}
                      <span className="ml-1 normal-case text-fg-faint/70">
                        {c.dataType}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-dash-border/40">
                {result.rows.map((row, i) => (
                  <tr key={i} className="hover:bg-dash-elevated/30">
                    {row.map((cell, j) => (
                      <td
                        key={j}
                        className="px-3 py-1.5 font-mono text-[11.5px] text-fg whitespace-nowrap"
                      >
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}
