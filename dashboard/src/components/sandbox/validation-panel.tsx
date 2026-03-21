import {
  AlertCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
} from "lucide-react"
import { useState } from "react"
import {
  useSandboxStore,
  type ValidationDiagnostic,
} from "@/stores/sandbox-store"

// ---------------------------------------------------------------------------
// Category display config
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  schema: "Schema",
  expression: "Expression",
  connector: "Connector",
  changelog: "Changelog",
  structure: "Structure",
  sql: "SQL",
}

const CATEGORY_ORDER = [
  "schema",
  "expression",
  "connector",
  "changelog",
  "structure",
  "sql",
]

function groupByCategory(diagnostics: ValidationDiagnostic[]) {
  const groups = new Map<string, ValidationDiagnostic[]>()
  for (const d of diagnostics) {
    const cat = d.category ?? "structure"
    const existing = groups.get(cat)
    if (existing) {
      existing.push(d)
    } else {
      groups.set(cat, [d])
    }
  }
  // Sort by canonical order
  return CATEGORY_ORDER.filter((c) => groups.has(c)).map((c) => ({
    category: c,
    label: CATEGORY_LABELS[c] ?? c,
    items: groups.get(c)!,
  }))
}

// ---------------------------------------------------------------------------
// Diagnostic detail expander
// ---------------------------------------------------------------------------

function DiagnosticRow({ d }: { d: ValidationDiagnostic }) {
  const [expanded, setExpanded] = useState(false)
  const hasDetails =
    d.details?.availableColumns?.length ||
    d.details?.missingProps?.length ||
    d.details?.expressionErrors?.length ||
    d.details?.referencedColumn

  return (
    <div className="border-b border-dash-border/50 last:border-b-0">
      <button
        type="button"
        className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-xs hover:bg-white/[0.03]"
        onClick={() => hasDetails && setExpanded(!expanded)}
      >
        {d.severity === "error" ? (
          <AlertCircle className="mt-0.5 size-3 shrink-0 text-job-failed" />
        ) : (
          <AlertTriangle className="mt-0.5 size-3 shrink-0 text-fr-amber" />
        )}
        <span
          className={
            d.severity === "error" ? "text-job-failed" : "text-fr-amber"
          }
        >
          {d.message}
        </span>
        {d.componentName && (
          <span className="ml-auto shrink-0 font-mono text-[10px] text-zinc-500">
            {d.componentName}
          </span>
        )}
      </button>
      {expanded && hasDetails && (
        <div className="px-8 pb-2 text-[11px] text-zinc-400">
          {d.details?.referencedColumn && (
            <p>
              Referenced column:{" "}
              <code className="text-zinc-300">
                {d.details.referencedColumn}
              </code>
            </p>
          )}
          {d.details?.availableColumns &&
            d.details.availableColumns.length > 0 && (
              <p>
                Available columns:{" "}
                <code className="text-zinc-300">
                  {d.details.availableColumns.join(", ")}
                </code>
              </p>
            )}
          {d.details?.missingProps && d.details.missingProps.length > 0 && (
            <p>
              Missing properties:{" "}
              <code className="text-zinc-300">
                {d.details.missingProps.join(", ")}
              </code>
            </p>
          )}
          {d.details?.expressionErrors?.map((err, i) => (
            <p key={i}>
              <code className="text-zinc-300">{err}</code>
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category group
// ---------------------------------------------------------------------------

function CategoryGroup({
  label,
  items,
}: {
  label: string
  items: ValidationDiagnostic[]
}) {
  const [open, setOpen] = useState(true)
  const errorCount = items.filter((d) => d.severity === "error").length
  const warningCount = items.filter((d) => d.severity === "warning").length

  return (
    <div>
      <button
        type="button"
        className="flex w-full items-center gap-2 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:bg-white/[0.03]"
        onClick={() => setOpen(!open)}
      >
        {open ? (
          <ChevronDown className="size-3 text-zinc-500" />
        ) : (
          <ChevronRight className="size-3 text-zinc-500" />
        )}
        {label}
        <div className="flex items-center gap-1.5 ml-auto">
          {errorCount > 0 && (
            <span className="rounded-full bg-red-500/20 px-1.5 py-0.5 text-[10px] font-medium text-job-failed">
              {errorCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] font-medium text-fr-amber">
              {warningCount}
            </span>
          )}
        </div>
      </button>
      {open && (
        <div className="border-t border-dash-border/50">
          {items.map((d, i) => (
            <DiagnosticRow key={i} d={d} />
          ))}
        </div>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function ValidationPanel() {
  const diagnostics = useSandboxStore((s) => s.diagnostics)
  const [collapsed, setCollapsed] = useState(false)

  if (diagnostics.length === 0) return null

  const groups = groupByCategory(diagnostics)
  const totalErrors = diagnostics.filter((d) => d.severity === "error").length
  const totalWarnings = diagnostics.filter(
    (d) => d.severity === "warning",
  ).length

  return (
    <div className="border-t border-dash-border">
      <button
        type="button"
        className="flex w-full items-center gap-2 px-4 py-1.5 text-xs font-medium text-zinc-400 hover:bg-white/[0.03]"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="size-3" />
        ) : (
          <ChevronDown className="size-3" />
        )}
        Validation
        <div className="flex items-center gap-1.5 ml-auto">
          {totalErrors > 0 && (
            <span className="text-job-failed">
              {totalErrors} {totalErrors === 1 ? "error" : "errors"}
            </span>
          )}
          {totalWarnings > 0 && (
            <span className="text-fr-amber">
              {totalWarnings} {totalWarnings === 1 ? "warning" : "warnings"}
            </span>
          )}
        </div>
      </button>
      {!collapsed && (
        <div className="max-h-48 overflow-auto">
          {groups.map((g) => (
            <CategoryGroup key={g.category} label={g.label} items={g.items} />
          ))}
        </div>
      )}
    </div>
  )
}
