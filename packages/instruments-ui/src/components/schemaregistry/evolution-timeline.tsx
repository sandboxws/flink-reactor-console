import { ChevronRight, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchSchemaDetail } from "../../api"
import type { SchemaDetail } from "../../types"
import { SchemaDiff } from "./schema-diff"
import { SchemaViewer } from "./schema-viewer"

export function EvolutionTimeline({
  instrumentName,
  subject,
  versions,
}: {
  instrumentName: string
  subject: string
  versions: number[]
}) {
  if (versions.length === 0) {
    return (
      <div className="glass-card p-4 text-sm text-zinc-500">
        No versions registered for this subject yet.
      </div>
    )
  }

  // Render newest first.
  const ordered = [...versions].sort((a, b) => b - a)

  return (
    <div className="space-y-3">
      {ordered.map((version, idx) => {
        const previous = ordered[idx + 1] ?? null
        return (
          <TimelineEntry
            key={version}
            instrumentName={instrumentName}
            subject={subject}
            version={version}
            previousVersion={previous}
            isLatest={idx === 0}
          />
        )
      })}
    </div>
  )
}

function TimelineEntry({
  instrumentName,
  subject,
  version,
  previousVersion,
  isLatest,
}: {
  instrumentName: string
  subject: string
  version: number
  previousVersion: number | null
  isLatest: boolean
}) {
  const [expanded, setExpanded] = useState(isLatest)
  const [detail, setDetail] = useState<SchemaDetail | null>(null)
  const [previous, setPrevious] = useState<SchemaDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDiff, setShowDiff] = useState(false)

  useEffect(() => {
    if (!expanded || detail) return
    setLoading(true)
    fetchSchemaDetail(instrumentName, subject, version)
      .then((d) => {
        setDetail(d)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false))
  }, [expanded, detail, instrumentName, subject, version])

  useEffect(() => {
    if (!showDiff || previous || previousVersion === null) return
    fetchSchemaDetail(instrumentName, subject, previousVersion)
      .then(setPrevious)
      .catch(() => setPrevious(null))
  }, [showDiff, previous, previousVersion, instrumentName, subject])

  return (
    <div className="glass-card overflow-hidden">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.03]"
      >
        <ChevronRight
          className={`size-3.5 text-zinc-500 transition-transform ${
            expanded ? "rotate-90" : ""
          }`}
        />
        <span className="font-mono text-sm text-zinc-200">v{version}</span>
        {isLatest && (
          <span className="rounded-full bg-fr-coral/15 px-2 py-0.5 text-[10px] font-medium uppercase text-fr-coral">
            latest
          </span>
        )}
        {previousVersion !== null && (
          <span className="ml-auto text-xs text-zinc-500">
            diff vs v{previousVersion}
          </span>
        )}
      </button>

      {expanded && (
        <div className="border-t border-dash-border p-4">
          {loading && (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="size-4 animate-spin text-zinc-500" />
            </div>
          )}
          {error && <div className="text-xs text-job-failed">{error}</div>}
          {detail && (
            <div className="space-y-3">
              {previousVersion !== null && (
                <button
                  type="button"
                  onClick={() => setShowDiff((v) => !v)}
                  className="rounded-md bg-white/[0.06] px-2.5 py-1 text-xs font-medium text-zinc-200 transition-colors hover:bg-white/[0.10]"
                >
                  {showDiff ? "Hide" : "Show"} diff vs v{previousVersion}
                </button>
              )}
              {showDiff && previous ? (
                <SchemaDiff before={previous} after={detail} />
              ) : (
                <SchemaViewer detail={detail} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
