import { Button, QueryResults } from "@flink-reactor/ui"
import { Clock, Loader2, Play } from "lucide-react"
import { useCallback, useState } from "react"
import { executeDatabaseQuery } from "@/lib/instruments/api"
import type { DatabaseQueryResult } from "@/lib/instruments/types"

export function QueryEditor({ instrumentName }: { instrumentName: string }) {
  const [sql, setSql] = useState("")
  const [executing, setExecuting] = useState(false)
  const [result, setResult] = useState<DatabaseQueryResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleExecute = useCallback(async () => {
    if (!sql.trim() || executing) return
    setExecuting(true)
    setError(null)
    setResult(null)
    try {
      const data = await executeDatabaseQuery(instrumentName, sql)
      setResult(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Query failed")
    } finally {
      setExecuting(false)
    }
  }, [instrumentName, sql, executing])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        handleExecute()
      }
    },
    [handleExecute],
  )

  return (
    <div className="space-y-3">
      {/* Editor */}
      <div className="glass-card overflow-hidden">
        <div className="flex items-center justify-between border-b border-dash-border px-3 py-1.5">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Clock className="size-3" />
            <span>Statement timeout: 30s</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={handleExecute}
            disabled={executing || !sql.trim()}
            className="h-7 gap-1.5 text-xs"
          >
            {executing ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Execute
          </Button>
        </div>
        <textarea
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="SELECT * FROM ..."
          spellCheck={false}
          className="h-32 w-full resize-y bg-transparent p-3 font-mono text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card border-job-failed/20 bg-job-failed/5 p-3 text-sm text-job-failed">
          {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <QueryResults
          columns={result.columns}
          rows={result.rows}
          rowCount={result.rowCount}
          executionTimeMs={result.executionTimeMs}
          truncated={result.truncated}
        />
      )}
    </div>
  )
}
