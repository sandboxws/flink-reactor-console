import { FileCode2 } from "lucide-react"
import { useCallback, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  EXPLORE_TEMPLATES,
  type ExploreTemplate,
  resolveTemplate,
  SAMPLE_QUERY_TEMPLATES,
} from "./explore-templates"
import { SqlHighlight } from "./sql-highlight"

interface TemplateSelectorProps {
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

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState("")
  const [database, setDatabase] = useState("")
  const [table, setTable] = useState("")
  const [selectedTemplate, setSelectedTemplate] =
    useState<ExploreTemplate | null>(null)

  const grouped = useMemo(
    () => groupByCategory([...EXPLORE_TEMPLATES, ...SAMPLE_QUERY_TEMPLATES]),
    [],
  )

  const previewSql = useMemo(() => {
    if (!selectedTemplate) return ""
    if (selectedTemplate.prefilled) return selectedTemplate.sql
    if (!catalog && !database && !table) return selectedTemplate.sql
    return resolveTemplate(
      selectedTemplate,
      catalog || "{{catalog}}",
      database || "{{database}}",
      table || "{{table}}",
    )
  }, [selectedTemplate, catalog, database, table])

  const canApply = useMemo(() => {
    if (!selectedTemplate) return false
    if (selectedTemplate.prefilled) return true
    return Boolean(catalog && database && table)
  }, [selectedTemplate, catalog, database, table])

  const handleApply = useCallback(() => {
    if (!selectedTemplate) return
    if (selectedTemplate.prefilled) {
      onSelect(selectedTemplate.sql)
    } else if (catalog && database && table) {
      onSelect(resolveTemplate(selectedTemplate, catalog, database, table))
    }
    setOpen(false)
  }, [selectedTemplate, catalog, database, table, onSelect])

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next)
    if (!next) {
      setSelectedTemplate(null)
      setCatalog("")
      setDatabase("")
      setTable("")
    }
  }, [])

  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="h-7 gap-1.5 text-xs"
      >
        <FileCode2 className="size-3" />
        Templates
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl p-0">
          <DialogHeader className="px-6 pt-6">
            <DialogTitle>Query Templates</DialogTitle>
            <DialogDescription>
              Browse sample queries or use a generic template with your own
              tables.
            </DialogDescription>
          </DialogHeader>

          <div
            className="flex border-t border-dash-border"
            style={{ height: 420 }}
          >
            {/* Left panel — template list */}
            <div className="w-56 shrink-0 overflow-y-auto border-r border-dash-border p-2">
              {Array.from(grouped.entries()).map(([category, templates]) => (
                <div key={category} className="mb-2">
                  <div className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">
                    {category}
                  </div>
                  {templates.map((tmpl) => (
                    <button
                      key={tmpl.name}
                      type="button"
                      onClick={() => setSelectedTemplate(tmpl)}
                      className={`w-full rounded px-2 py-1.5 text-left text-xs transition-colors ${
                        selectedTemplate?.name === tmpl.name
                          ? "bg-white/[0.08] text-white"
                          : "text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-300"
                      }`}
                    >
                      <div className="font-medium">{tmpl.name}</div>
                      <div className="text-[10px] text-zinc-500">
                        {tmpl.description}
                      </div>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            {/* Right panel — SQL preview + inputs */}
            <div className="flex min-w-0 flex-1 flex-col">
              {selectedTemplate ? (
                <>
                  {/* SQL preview */}
                  <div className="flex-1 overflow-auto p-4">
                    <SqlHighlight
                      code={previewSql}
                      className="[&_pre]:!m-0 [&_pre]:!rounded-md [&_pre]:!bg-[#1a1b26] [&_pre]:!p-4 [&_pre]:text-xs"
                    />
                  </div>

                  {/* Placeholder inputs for generic templates */}
                  {!selectedTemplate.prefilled && (
                    <div className="flex gap-2 border-t border-dash-border px-4 py-3">
                      <input
                        type="text"
                        placeholder="Catalog"
                        value={catalog}
                        onChange={(e) => setCatalog(e.target.value)}
                        className="w-0 flex-1 rounded border border-dash-border bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
                      />
                      <input
                        type="text"
                        placeholder="Database"
                        value={database}
                        onChange={(e) => setDatabase(e.target.value)}
                        className="w-0 flex-1 rounded border border-dash-border bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
                      />
                      <input
                        type="text"
                        placeholder="Table"
                        value={table}
                        onChange={(e) => setTable(e.target.value)}
                        className="w-0 flex-1 rounded border border-dash-border bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
                      />
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
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
