import { Loader2, Play, Square } from "lucide-react"
import { useCallback } from "react"
import { Button } from "@/components/ui/button"
import { useCatalogExploreStore } from "@/stores/catalog-explore-store"

export function ExploreEditor() {
  const sql = useCatalogExploreStore((s) => s.sql)
  const setSql = useCatalogExploreStore((s) => s.setSql)
  const status = useCatalogExploreStore((s) => s.status)
  const executeQuery = useCatalogExploreStore((s) => s.executeQuery)
  const cancelQuery = useCatalogExploreStore((s) => s.cancelQuery)

  const isRunning = status === "submitting" || status === "running"

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault()
        if (isRunning) return
        executeQuery()
      }
    },
    [executeQuery, isRunning],
  )

  return (
    <div className="glass-card overflow-hidden">
      <div className="flex items-center justify-between border-b border-dash-border px-3 py-1.5">
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          {status === "submitting" && (
            <span className="flex items-center gap-1 text-fr-amber">
              <Loader2 className="size-3 animate-spin" />
              Submitting...
            </span>
          )}
          {status === "running" && (
            <span className="flex items-center gap-1 text-job-running">
              <Loader2 className="size-3 animate-spin" />
              Running
            </span>
          )}
          {status === "completed" && (
            <span className="text-job-finished">Completed</span>
          )}
          {status === "failed" && (
            <span className="text-job-failed">Failed</span>
          )}
          {status === "cancelled" && (
            <span className="text-job-cancelled">Cancelled</span>
          )}
          {status === "idle" && <span>Cmd+Enter to run</span>}
        </div>
        <div className="flex items-center gap-1.5">
          {isRunning && (
            <Button
              size="sm"
              variant="outline"
              onClick={cancelQuery}
              className="h-7 gap-1.5 text-xs text-job-failed"
            >
              <Square className="size-3" />
              Cancel
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={executeQuery}
            disabled={isRunning || !sql.trim()}
            className="h-7 gap-1.5 text-xs"
          >
            {isRunning ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Run
          </Button>
        </div>
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
  )
}
