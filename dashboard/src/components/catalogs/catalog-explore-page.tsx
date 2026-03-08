import { AlertTriangle, FlaskConical } from "lucide-react"
import { QueryResults } from "@/components/shared/query-results"
import { useCatalogExploreStore } from "@/stores/catalog-explore-store"
import { ExploreEditor } from "./explore-editor"
import { TemplateSelector } from "./template-selector"

const MAX_ROWS = 10_000

export function CatalogExplorePage() {
  const setSql = useCatalogExploreStore((s) => s.setSql)
  const status = useCatalogExploreStore((s) => s.status)
  const columns = useCatalogExploreStore((s) => s.columns)
  const rows = useCatalogExploreStore((s) => s.rows)
  const streaming = useCatalogExploreStore((s) => s.streaming)
  const error = useCatalogExploreStore((s) => s.error)

  const hasResults = columns.length > 0

  // Convert string[][] rows to the {v: value}[][] format expected by QueryResults
  const formattedRows = rows.map((row) =>
    row.map((cell) => (cell === null ? null : { v: cell })),
  )

  return (
    <div className="space-y-3 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FlaskConical className="size-4 text-zinc-400" />
          <h1 className="text-sm font-medium text-zinc-200">
            Explore Catalogs
          </h1>
        </div>
        <TemplateSelector onSelect={setSql} />
      </div>

      {/* Editor */}
      <ExploreEditor />

      {/* Error */}
      {error && (
        <div className="glass-card border-job-failed/20 bg-job-failed/5 p-3 text-sm text-job-failed">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Results */}
      {hasResults && (
        <QueryResults
          columns={columns}
          rows={formattedRows}
          rowCount={rows.length}
          streaming={streaming}
          truncated={rows.length >= MAX_ROWS}
        />
      )}

      {/* Empty result after completion */}
      {status === "completed" && !hasResults && !error && (
        <div className="glass-card p-4 text-center text-xs text-zinc-500">
          Query returned no rows
        </div>
      )}
    </div>
  )
}
