// ── Synth Inspector ──────────────────────────────────────────────────
// Debug panel showing raw synthesizer output: statements array and
// statementOrigins map as a collapsible, syntax-highlighted JSON tree.
// Used under the SQL tab to help diagnose focus-highlighting behavior.

import { ChevronDown, ChevronRight } from "lucide-react"
import { useCallback, useState } from "react"
import type { SqlFragment, StatementOrigin } from "@/lib/sandbox-synthesizer"

// ---------------------------------------------------------------------------
// Serialise statementOrigins (ReadonlyMap) to a plain object for display
// ---------------------------------------------------------------------------

function originsToObject(
  origins: ReadonlyMap<number, StatementOrigin>,
): Record<string, StatementOrigin> {
  const obj: Record<string, StatementOrigin> = {}
  for (const [k, v] of origins) {
    obj[String(k)] = v
  }
  return obj
}

function contributorsToObject(
  contributors: ReadonlyMap<number, readonly SqlFragment[]>,
): Record<string, readonly SqlFragment[]> {
  const obj: Record<string, readonly SqlFragment[]> = {}
  for (const [k, v] of contributors) {
    obj[String(k)] = v
  }
  return obj
}

// ---------------------------------------------------------------------------
// Recursive collapsible JSON tree
// ---------------------------------------------------------------------------

interface JsonNodeProps {
  label?: string
  value: unknown
  depth: number
  defaultOpen?: boolean
}

function JsonNode({ label, value, depth, defaultOpen = false }: JsonNodeProps) {
  const [open, setOpen] = useState(defaultOpen)
  const toggle = useCallback(() => setOpen((o) => !o), [])

  const indent = depth * 16

  // Primitive value
  if (
    value === null ||
    value === undefined ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return (
      <div className="flex items-baseline" style={{ paddingLeft: indent }}>
        {label != null && (
          <span className="mr-1.5 text-[--color-log-debug]">
            {typeof label === "string" ? `"${label}"` : label}:
          </span>
        )}
        <span className={primitiveClass(value)}>{formatPrimitive(value)}</span>
      </div>
    )
  }

  // Array or Object
  const isArray = Array.isArray(value)
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [String(i), v] as const)
    : Object.entries(value as Record<string, unknown>)
  const bracketOpen = isArray ? "[" : "{"
  const bracketClose = isArray ? "]" : "}"
  const isEmpty = entries.length === 0

  if (isEmpty) {
    return (
      <div className="flex items-baseline" style={{ paddingLeft: indent }}>
        {label != null && (
          <span className="mr-1.5 text-[--color-log-debug]">
            {typeof label === "string" ? `"${label}"` : label}:
          </span>
        )}
        <span className="text-zinc-500">
          {bracketOpen}
          {bracketClose}
        </span>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={toggle}
        className="flex w-full items-baseline text-left hover:bg-white/5"
        style={{ paddingLeft: indent }}
      >
        {open ? (
          <ChevronDown className="mr-1 size-3 shrink-0 self-center text-zinc-500" />
        ) : (
          <ChevronRight className="mr-1 size-3 shrink-0 self-center text-zinc-500" />
        )}
        {label != null && (
          <span className="mr-1.5 text-[--color-log-debug]">
            {typeof label === "string" ? `"${label}"` : label}:
          </span>
        )}
        <span className="text-zinc-500">
          {bracketOpen}
          {open ? "" : ` … ${entries.length} items ${bracketClose}`}
        </span>
      </button>
      {open && (
        <>
          {entries.map(([key, val]) => (
            <JsonNode
              key={key}
              label={key}
              value={val}
              depth={depth + 1}
              defaultOpen={depth < 1}
            />
          ))}
          <div className="text-zinc-500" style={{ paddingLeft: indent }}>
            {bracketClose}
          </div>
        </>
      )}
    </div>
  )
}

function primitiveClass(value: unknown): string {
  if (value === null || value === undefined) return "text-zinc-500 italic"
  if (typeof value === "string") return "text-[--color-job-running]"
  if (typeof value === "number") return "text-[--color-fr-amber]"
  if (typeof value === "boolean") return "text-[--color-fr-purple]"
  return "text-zinc-300"
}

function formatPrimitive(value: unknown): string {
  if (value === null) return "null"
  if (value === undefined) return "undefined"
  if (typeof value === "string") return `"${value}"`
  return String(value)
}

// ---------------------------------------------------------------------------
// Main inspector component
// ---------------------------------------------------------------------------

interface SynthInspectorProps {
  statements: readonly string[]
  statementOrigins: ReadonlyMap<number, StatementOrigin>
  statementContributors: ReadonlyMap<number, readonly SqlFragment[]>
}

export function SynthInspector({
  statements,
  statementOrigins,
  statementContributors,
}: SynthInspectorProps) {
  const data = {
    statements: [...statements],
    statementOrigins: originsToObject(statementOrigins),
    statementContributors: contributorsToObject(statementContributors),
  }

  return <JsonNode value={data} depth={0} defaultOpen />
}
