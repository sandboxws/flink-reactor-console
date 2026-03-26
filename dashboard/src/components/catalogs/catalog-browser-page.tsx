/**
 * @module catalog-browser-page
 *
 * Top-level page for browsing Flink SQL catalogs. Fetches the catalog list
 * from the server on mount via {@link useCatalogStore} and renders a
 * navigable tree of catalogs, databases, and tables.
 */

import { Button, Spinner } from "@flink-reactor/ui"
import { AlertTriangle, Database, RefreshCw } from "lucide-react"
import { useEffect } from "react"
import { useCatalogStore } from "@/stores/catalog-store"
import { CatalogTree } from "./catalog-tree"

/**
 * Catalog browser page with a refresh button, error display, and
 * the collapsible {@link CatalogTree}. Triggers initial catalog
 * fetch on mount.
 */
export function CatalogBrowserPage() {
  const loading = useCatalogStore((s) => s.loading)
  const error = useCatalogStore((s) => s.error)
  const fetchCatalogs = useCatalogStore((s) => s.fetchCatalogs)

  useEffect(() => {
    fetchCatalogs()
  }, [fetchCatalogs])

  return (
    <div className="space-y-4 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Database className="size-4 text-zinc-400" />
          <h1 className="text-sm font-medium text-zinc-200">
            Available Catalogs
          </h1>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={fetchCatalogs}
          disabled={loading}
          className="h-7 gap-1.5 text-xs"
        >
          <RefreshCw className={`size-3 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Error */}
      {error && (
        <div className="glass-card border-job-failed/20 bg-job-failed/5 p-3 text-sm text-job-failed">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-4 shrink-0" />
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center p-8">
          <Spinner size="lg" />
        </div>
      )}

      {/* Tree */}
      {!loading && (
        <div className="glass-card p-2">
          <CatalogTree />
        </div>
      )}
    </div>
  )
}
