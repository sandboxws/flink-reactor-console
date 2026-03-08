import { FileCode2 } from "lucide-react"
import { useCallback, useState } from "react"
import { Button } from "@/components/ui/button"
import {
  EXPLORE_TEMPLATES,
  type ExploreTemplate,
  resolveTemplate,
} from "./explore-templates"

interface TemplateSelectorProps {
  onSelect: (sql: string) => void
}

export function TemplateSelector({ onSelect }: TemplateSelectorProps) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState("")
  const [database, setDatabase] = useState("")
  const [table, setTable] = useState("")
  const [selectedTemplate, setSelectedTemplate] =
    useState<ExploreTemplate | null>(null)

  const handleApply = useCallback(() => {
    if (!selectedTemplate || !catalog || !database || !table) return
    const sql = resolveTemplate(selectedTemplate, catalog, database, table)
    onSelect(sql)
    setOpen(false)
  }, [selectedTemplate, catalog, database, table, onSelect])

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(!open)}
        className="h-7 gap-1.5 text-xs"
      >
        <FileCode2 className="size-3" />
        Templates
      </Button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-80 rounded-md border border-dash-border bg-dash-panel p-3 shadow-lg">
          {/* Template list */}
          <div className="mb-3 space-y-1">
            {EXPLORE_TEMPLATES.map((tmpl) => (
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

          {/* Placeholder inputs */}
          {selectedTemplate && (
            <div className="space-y-2 border-t border-dash-border pt-2">
              <input
                type="text"
                placeholder="Catalog name"
                value={catalog}
                onChange={(e) => setCatalog(e.target.value)}
                className="w-full rounded border border-dash-border bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
              />
              <input
                type="text"
                placeholder="Database name"
                value={database}
                onChange={(e) => setDatabase(e.target.value)}
                className="w-full rounded border border-dash-border bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
              />
              <input
                type="text"
                placeholder="Table name"
                value={table}
                onChange={(e) => setTable(e.target.value)}
                className="w-full rounded border border-dash-border bg-transparent px-2 py-1 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-fr-coral/50"
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleApply}
                disabled={!catalog || !database || !table}
                className="h-7 w-full text-xs"
              >
                Apply Template
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
