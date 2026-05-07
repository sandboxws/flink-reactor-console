/**
 * SchemaDiffViewer — fetches two schema versions for a subject in
 * parallel and renders the difference via the existing `<DiffViewer>`
 * primitive (sage / coral background tints, no left-border accents).
 *
 * Used by `/hub/instruments/$instrumentName/schema-registry/subject`.
 * No backend resolver required — composes existing `schemaDetail`
 * queries.
 */

import { DiffViewer } from "@flink-reactor/ui"
import { useEffect, useState } from "react"
import { fetchSchemaDetail, type SchemaDetail } from "@/lib/instruments-data"

interface SchemaDiffViewerProps {
  instrument: string
  subject: string
  versionA: number
  versionB: number
}

export function SchemaDiffViewer({
  instrument,
  subject,
  versionA,
  versionB,
}: SchemaDiffViewerProps) {
  const [a, setA] = useState<SchemaDetail | null>(null)
  const [b, setB] = useState<SchemaDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setA(null)
    setB(null)
    setError(null)
    Promise.all([
      fetchSchemaDetail(instrument, subject, versionA),
      fetchSchemaDetail(instrument, subject, versionB),
    ])
      .then(([left, right]) => {
        if (cancelled) return
        setA(left)
        setB(right)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load schemas")
      })
    return () => {
      cancelled = true
    }
  }, [instrument, subject, versionA, versionB])

  if (error) {
    return <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
  }
  if (!a || !b) {
    return (
      <p className="text-[11.5px] font-mono text-fg-faint">Loading schemas…</p>
    )
  }

  if (versionA === versionB || a.schema === b.schema) {
    return (
      <div className="glass-card-static p-6 text-center">
        <p className="text-[12px] text-fg-muted">
          Schema unchanged between v{versionA} and v{versionB}.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between font-mono text-[10px] uppercase tracking-wider text-fg-faint">
        <span>
          v{a.version} (id {a.id})
        </span>
        <span>
          v{b.version} (id {b.id})
        </span>
      </div>
      <DiffViewer a={prettyJson(a.schema)} b={prettyJson(b.schema)} />
    </div>
  )
}

/** Pretty-print JSON; pass through if not parseable (Avro/Protobuf strings). */
function prettyJson(s: string): string {
  try {
    return JSON.stringify(JSON.parse(s), null, 2)
  } catch {
    return s
  }
}
