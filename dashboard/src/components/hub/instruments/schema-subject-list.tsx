/**
 * SchemaSubjectList — Schema Registry overview for an instrument.
 *
 * A KPI strip (subjects, versions, default compatibility, conflicts), a
 * governance conflict banner, and the subjects table. A subject is flagged
 * when it has no compatibility enforcement (NONE) or is weaker than the
 * registry default — see `schema-registry-derive.ts`. Click a row to drill
 * into the subject detail (diff viewer + version timeline + consumers).
 */

import { KpiCard, SevBadge } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { AlertTriangle, FileJson } from "lucide-react"
import { useEffect, useState } from "react"
import {
  fetchSchemaRegistryConfig,
  fetchSchemaSubjects,
  type SchemaSubject,
} from "@/lib/instruments-data"
import {
  conflictSubjects,
  isSubjectConflict,
  registryKpis,
} from "./schema-registry-derive"

interface SchemaSubjectListProps {
  instrument: string
}

export function SchemaSubjectList({ instrument }: SchemaSubjectListProps) {
  const [subjects, setSubjects] = useState<SchemaSubject[] | null>(null)
  const [defaultCompat, setDefaultCompat] = useState<string>("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setSubjects(null)
    Promise.all([
      fetchSchemaSubjects(instrument),
      // The registry may restrict the global /config endpoint; degrade to an
      // unknown default rather than failing the whole view.
      fetchSchemaRegistryConfig(instrument).catch(() => ({
        compatibility: "",
      })),
    ])
      .then(([subs, cfg]) => {
        if (cancelled) return
        setSubjects(subs)
        setDefaultCompat(cfg.compatibility)
        setError(null)
      })
      .catch((e) => {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to load subjects")
        setSubjects([])
      })
    return () => {
      cancelled = true
    }
  }, [instrument])

  if (subjects === null) {
    return (
      <p className="text-[11.5px] font-mono text-fg-faint">Loading subjects…</p>
    )
  }
  if (error) {
    return <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
  }
  if (subjects.length === 0) {
    return (
      <div className="glass-card-static p-8 text-center">
        <FileJson className="mx-auto size-6 text-fr-coral/50" />
        <p className="mt-3 text-[12px] text-fg-muted">
          No subjects registered.
        </p>
      </div>
    )
  }

  const kpis = registryKpis(subjects, defaultCompat)
  const conflicts = conflictSubjects(subjects, defaultCompat)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="Subjects" value={kpis.subjects} />
        <KpiCard label="Versions" value={kpis.versions.toLocaleString()} />
        <KpiCard label="Default compatibility" value={kpis.defaultCompat} />
        <KpiCard
          label="Conflicts"
          value={kpis.conflicts}
          sub={kpis.conflicts > 0 ? "needs review" : "all guarded"}
        />
      </div>

      {conflicts.length > 0 ? (
        <div className="flex items-start gap-2 rounded-md border border-fr-amber/30 bg-fr-amber/5 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-fr-amber" />
          <div className="text-[11.5px] text-fg">
            <span className="font-medium text-fr-amber">
              {conflicts.length} subject{conflicts.length === 1 ? "" : "s"}
            </span>{" "}
            {conflicts.length === 1 ? "is" : "are"} unguarded or weaker than the{" "}
            <span className="font-mono">{kpis.defaultCompat}</span> default:{" "}
            <span className="font-mono text-fg-muted">
              {conflicts
                .slice(0, 4)
                .map((c) => c.name)
                .join(", ")}
              {conflicts.length > 4 ? `, +${conflicts.length - 4} more` : ""}
            </span>
          </div>
        </div>
      ) : null}

      <div className="glass-card-static overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            <tr className="border-b border-dash-border text-left text-fg-faint">
              <th className="w-8 px-3 py-2" />
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Subject
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Format
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Latest
              </th>
              <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
                Compatibility
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border/40">
            {subjects.map((s) => {
              const conflict = isSubjectConflict(s, defaultCompat)
              return (
                <tr key={s.name} className="hover:bg-dash-elevated/30">
                  <td className="px-3 py-2">
                    {conflict ? (
                      <AlertTriangle
                        className="size-3.5 text-fr-amber"
                        aria-label="compatibility conflict"
                      />
                    ) : (
                      <FileJson
                        className="size-3.5 text-fr-sage"
                        aria-hidden="true"
                      />
                    )}
                  </td>
                  <td className="px-4 py-2 font-mono">
                    <Link
                      to="/hub/instruments/$instrumentName/schema-registry/subject"
                      params={{ instrumentName: instrument }}
                      search={{ subject: s.name }}
                      className="text-fr-coral hover:underline"
                    >
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2 font-mono text-fg-muted">
                    {s.schemaType || "AVRO"}
                  </td>
                  <td className="px-4 py-2 font-mono text-fg">
                    v{s.latestVersion}
                  </td>
                  <td className="px-4 py-2">
                    {conflict ? (
                      <SevBadge tone="warn">{s.compatibility}</SevBadge>
                    ) : (
                      <span className="prop-chip">{s.compatibility}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
