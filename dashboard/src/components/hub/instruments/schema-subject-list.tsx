/**
 * SchemaSubjectList — list of Schema Registry subjects for an
 * instrument with their latest version + compatibility level. Click a
 * row to drill into the subject detail (which includes the diff viewer).
 */

import { Link } from "@tanstack/react-router"
import { FileJson } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchSchemaSubjects, type SchemaSubject } from "@/lib/instruments-data"

interface SchemaSubjectListProps {
  instrument: string
}

export function SchemaSubjectList({ instrument }: SchemaSubjectListProps) {
  const [subjects, setSubjects] = useState<SchemaSubject[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchSchemaSubjects(instrument)
      .then((list) => {
        if (!cancelled) setSubjects(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load subjects")
          setSubjects([])
        }
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

  return (
    <div className="glass-card-static overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="border-b border-dash-border text-left text-fg-faint">
            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
              Subject
            </th>
            <th className="px-4 py-2 font-mono text-[10px] uppercase tracking-wider">
              Type
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
          {subjects.map((s) => (
            <tr key={s.name} className="hover:bg-dash-elevated/30">
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
                <span className="prop-chip">{s.compatibility}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
