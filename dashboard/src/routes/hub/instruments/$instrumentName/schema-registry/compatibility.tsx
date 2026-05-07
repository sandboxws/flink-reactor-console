/**
 * Hub Schema compatibility check —
 * /hub/instruments/$instrumentName/schema-registry/compatibility.
 *
 * Allows the user to paste a candidate schema and check whether it is
 * compatible with the latest version of a chosen subject (the
 * `checkSchemaCompatibility` mutation is read-only on the registry —
 * the schema is NOT registered).
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { CheckCircle2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import {
  checkSchemaCompatibility,
  fetchSchemaSubjects,
  type SchemaSubject,
} from "@/lib/instruments-data"
import { SchemaRegistrySubTabs } from "./index"

function HubSchemaCompatibility() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/schema-registry/compatibility",
  })
  const [subjects, setSubjects] = useState<SchemaSubject[]>([])
  const [subject, setSubject] = useState("")
  const [schemaType, setSchemaType] = useState("AVRO")
  const [candidate, setCandidate] = useState("")
  const [result, setResult] = useState<{
    isCompatible: boolean
    messages: string[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)

  useEffect(() => {
    fetchSchemaSubjects(instrumentName)
      .then(setSubjects)
      .catch(() => setSubjects([]))
  }, [instrumentName])

  const run = async () => {
    if (!subject || !candidate.trim()) return
    setRunning(true)
    setError(null)
    setResult(null)
    try {
      const r = await checkSchemaCompatibility(
        instrumentName,
        subject,
        candidate,
        schemaType,
      )
      setResult(r)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Compatibility check failed")
    } finally {
      setRunning(false)
    }
  }

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          {
            label: "Schema registry",
            to: "/hub/instruments/$instrumentName/schema-registry".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: "Compatibility" },
        ]}
        LinkComponent={HubLink}
      />
      <SchemaRegistrySubTabs
        instrument={instrumentName}
        active="compatibility"
      />

      <div className="mt-5 grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <div className="glass-card-static p-4">
            <h3 className="section-heading mb-3">Candidate schema</h3>
            <div className="mb-3 flex flex-wrap gap-3">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="rounded-md border border-dash-border bg-dash-panel px-2 py-1 font-mono text-[11.5px] text-fg"
              >
                <option value="">Pick a subject…</option>
                {subjects.map((s) => (
                  <option key={s.name} value={s.name}>
                    {s.name}
                  </option>
                ))}
              </select>
              <select
                value={schemaType}
                onChange={(e) => setSchemaType(e.target.value)}
                className="rounded-md border border-dash-border bg-dash-panel px-2 py-1 font-mono text-[11.5px] text-fg"
              >
                <option value="AVRO">AVRO</option>
                <option value="JSON">JSON</option>
                <option value="PROTOBUF">PROTOBUF</option>
              </select>
              <button
                type="button"
                onClick={run}
                disabled={!subject || !candidate.trim() || running}
                className="btn btn-secondary btn-sm ml-auto"
              >
                {running ? "Checking…" : "Check compatibility"}
              </button>
            </div>
            <textarea
              value={candidate}
              onChange={(e) => setCandidate(e.target.value)}
              spellCheck={false}
              rows={14}
              placeholder="Paste a schema definition…"
              className="w-full rounded-md border border-dash-border bg-dash-surface px-3 py-2 font-mono text-[11.5px] text-fg outline-none placeholder:text-fg-faint"
            />
          </div>
        </div>

        <aside className="col-span-12 lg:col-span-4">
          <div className="glass-card-static p-4">
            <h3 className="section-heading mb-3">Result</h3>
            {error ? (
              <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
            ) : !result ? (
              <p className="text-[12px] text-fg-muted">
                Run a check to see compatibility status.
              </p>
            ) : (
              <div>
                <div
                  className={
                    result.isCompatible
                      ? "flex items-center gap-2 text-fr-sage"
                      : "flex items-center gap-2 text-fr-rose"
                  }
                >
                  {result.isCompatible ? (
                    <CheckCircle2 className="size-4" />
                  ) : (
                    <XCircle className="size-4" />
                  )}
                  <span className="font-mono text-[12px]">
                    {result.isCompatible ? "Compatible" : "Incompatible"}
                  </span>
                </div>
                {result.messages.length > 0 ? (
                  <ul className="mt-3 space-y-1.5 text-[11.5px] font-mono text-fg-muted">
                    {result.messages.map((m, i) => (
                      <li key={i} className="break-words">
                        — {m}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            )}
          </div>
        </aside>
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/schema-registry/compatibility",
)({
  component: HubSchemaCompatibility,
})
