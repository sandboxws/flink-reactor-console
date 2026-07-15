import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchSchemaVersions } from "@/lib/instruments/api"
import { EvolutionTimeline } from "./evolution-timeline"

export function SubjectDetail({
  instrumentName,
  subject,
}: {
  instrumentName: string
  subject: string
}) {
  const [versions, setVersions] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchSchemaVersions(instrumentName, subject)
      .then((data) => {
        setVersions(data)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false))
  }, [instrumentName, subject])

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

  return (
    <div className="space-y-3">
      <div className="glass-card flex items-center gap-3 p-3">
        <span className="font-mono text-sm text-zinc-200">{subject}</span>
        <span className="ml-auto text-xs text-zinc-500">
          {versions.length} version{versions.length === 1 ? "" : "s"}
        </span>
      </div>
      <EvolutionTimeline
        instrumentName={instrumentName}
        subject={subject}
        versions={versions}
      />
    </div>
  )
}
