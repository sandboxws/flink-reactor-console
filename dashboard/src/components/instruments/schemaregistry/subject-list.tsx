import { FileText, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchSchemaSubjects } from "@/lib/instruments/api"
import type { SchemaSubject } from "@/lib/instruments/types"
import { SCHEMA_TYPE_BADGE } from "./lib"

type LinkProps = {
  to: string
  search?: Record<string, string>
  className?: string
  children: React.ReactNode
}

export function SubjectList({
  instrumentName,
  LinkComponent,
}: {
  instrumentName: string
  LinkComponent: React.ComponentType<LinkProps>
}) {
  const [subjects, setSubjects] = useState<SchemaSubject[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchSchemaSubjects(instrumentName)
      .then((data) => {
        setSubjects(data)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false))
  }, [instrumentName])

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error) {
    return <div className="glass-card p-4 text-sm text-job-failed">{error}</div>
  }

  if (subjects.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-2 p-8 text-center">
        <FileText className="size-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">No subjects in this registry</p>
      </div>
    )
  }

  return (
    <div className="glass-card overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-dash-border text-left text-zinc-500">
            <th className="px-3 py-2 font-medium">Subject</th>
            <th className="px-3 py-2 font-medium">Type</th>
            <th className="px-3 py-2 font-medium">Latest</th>
            <th className="px-3 py-2 font-medium">Schema ID</th>
            <th className="px-3 py-2 font-medium">Compatibility</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dash-border">
          {subjects.map((s) => (
            <tr key={s.name} className="hover:bg-white/[0.02]">
              <td className="px-3 py-1.5">
                <LinkComponent
                  to={`/instruments/${instrumentName}/schema-registry/subject`}
                  search={{ subject: s.name }}
                  className="font-mono text-zinc-200 hover:text-fr-coral"
                >
                  {s.name}
                </LinkComponent>
              </td>
              <td className="px-3 py-1.5">
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${
                    SCHEMA_TYPE_BADGE[s.schemaType] ??
                    "bg-white/[0.08] text-zinc-300"
                  }`}
                >
                  {s.schemaType}
                </span>
              </td>
              <td className="px-3 py-1.5 font-mono text-zinc-400">
                v{s.latestVersion}
              </td>
              <td className="px-3 py-1.5 font-mono text-zinc-500">
                {s.schemaId || "—"}
              </td>
              <td className="px-3 py-1.5 text-zinc-400">
                {s.compatibility || "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
