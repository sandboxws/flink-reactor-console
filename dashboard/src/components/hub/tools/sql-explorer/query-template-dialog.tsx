/**
 * Hub-styled query template picker dialog for the SQL Explorer.
 *
 * Reuses the shared template data from `explore-templates.ts` and renders
 * them in a categorised left/right split dialog with live SQL preview.
 */

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@flink-reactor/ui"
import { FileCode2 } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import {
  EXPLORE_TEMPLATES,
  type ExploreTemplate,
  resolveTemplate,
  SAMPLE_QUERY_TEMPLATES,
} from "@/components/catalogs/explore-templates"
import { SqlHighlight } from "@/components/catalogs/sql-highlight"

interface QueryTemplateDialogProps {
  onSelect: (sql: string) => void
}

function groupByCategory(
  templates: ExploreTemplate[],
): Map<string, ExploreTemplate[]> {
  const groups = new Map<string, ExploreTemplate[]>()
  for (const tmpl of templates) {
    const key = tmpl.category ?? "General"
    const list = groups.get(key)
    if (list) {
      list.push(tmpl)
    } else {
      groups.set(key, [tmpl])
    }
  }
  return groups
}

export function QueryTemplateDialog({ onSelect }: QueryTemplateDialogProps) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState("")
  const [database, setDatabase] = useState("")
  const [table, setTable] = useState("")
  const [selected, setSelected] = useState<ExploreTemplate | null>(null)

  const grouped = useMemo(
    () => groupByCategory([...EXPLORE_TEMPLATES, ...SAMPLE_QUERY_TEMPLATES]),
    [],
  )

  const previewSql = useMemo(() => {
    if (!selected) return ""
    if (selected.prefilled) return selected.sql
    if (!catalog && !database && !table) return selected.sql
    return resolveTemplate(
      selected,
      catalog || "{{catalog}}",
      database || "{{database}}",
      table || "{{table}}",
    )
  }, [selected, catalog, database, table])

  const canApply = useMemo(() => {
    if (!selected) return false
    if (selected.prefilled) return true
    return Boolean(catalog && database && table)
  }, [selected, catalog, database, table])

  const handleApply = useCallback(() => {
    if (!selected) return
    if (selected.prefilled) {
      onSelect(selected.sql)
    } else if (catalog && database && table) {
      onSelect(resolveTemplate(selected, catalog, database, table))
    }
    setOpen(false)
  }, [selected, catalog, database, table, onSelect])

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      setSelected(null)
      setCatalog("")
      setDatabase("")
      setTable("")
    }
  }, [])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="btn btn-ghost btn-sm"
      >
        <FileCode2 className="size-3" />
        Templates
      </button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl border-dash-border bg-dash-panel p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle className="font-sans text-[15px] font-medium text-fg">
              Query Templates
            </DialogTitle>
            <DialogDescription className="font-mono text-[11px] text-fg-muted">
              Browse sample queries or use a generic template with your own
              tables.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex border-t border-dash-border"
            style={{ height: 420 }}
          >
            {/* Left — template list */}
            <div className="w-60 shrink-0 overflow-y-auto border-r border-dash-border p-2">
              {Array.from(grouped.entries()).map(([category, templates]) => (
                <div key={category} className="mb-3">
                  <div className="section-heading mb-1 px-2 pt-1">
                    {category}
                  </div>
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => setSelected(tmpl)}
                      className={`w-full rounded-md px-2 py-1.5 text-left transition-colors ${
                        selected?.name === tmpl.name
                          ? "bg-fr-coral/10 text-fg"
                          : "text-fg-muted hover:bg-dash-elevated/40 hover:text-fg"
                      }`}
                    >
                      <div className="font-sans text-[12px] font-medium">
                        {tmpl.name}
                      </div>
                      <div className="font-mono text-[10px] text-fg-faint">
                        {tmpl.description}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Right — SQL preview + placeholder inputs */}
            <div className="flex min-w-0 flex-1 flex-col">
              {selected ? (
                <>
                  <div className="flex-1 overflow-auto p-4">
                    <SqlHighlight
                      code={previewSql}
                      className="[&_pre]:!m-0 [&_pre]:!rounded-md [&_pre]:!bg-fr-bg [&_pre]:!p-4 [&_pre]:text-xs"
                    />
                  </div>

                  {!selected.prefilled && (
                    <div className="flex gap-2 border-t border-dash-border px-4 py-3">
                      <input
                        type="text"
                        placeholder="Catalog"
                        value={catalog}
                        onChange={(e) => setCatalog(e.target.value)}
                        className="w-0 flex-1 rounded-md border border-dash-border bg-transparent px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
                      />
                      <input
                        type="text"
                        placeholder="Database"
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className="w-0 flex-1 rounded-md border border-dash-border bg-transparent px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
                      />
                      <input
                        type="text"
                        placeholder="Table"
                        value={table}
                        onChange={(e) => setTable(e.target.value)}
                        className="w-0 flex-1 rounded-md border border-dash-border bg-transparent px-2 py-1 font-mono text-[11px] text-fg placeholder:text-fg-faint focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center font-mono text-[11px] text-fg-faint">
                  Select a template to preview
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="border-t border-dash-border px-6 py-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button size="sm" disabled={!canApply} onClick={handleApply}>
              Use Query
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
