import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import {
  checkSchemaCompatibility,
  fetchSchemaSubjects,
} from "@/lib/instruments/api"
import type {
  CompatibilityResult,
  SchemaSubject,
  SchemaType,
} from "@/lib/instruments/types"

const SCHEMA_TYPES: SchemaType[] = ["AVRO", "PROTOBUF", "JSON"]

export function CompatibilityChecker({
  instrumentName,
}: {
  instrumentName: string
}) {
  const [subjects, setSubjects] = useState<SchemaSubject[]>([])
  const [subject, setSubject] = useState("")
  const [schemaType, setSchemaType] = useState<SchemaType>("AVRO")
  const [schema, setSchema] = useState("")
  const [result, setResult] = useState<CompatibilityResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // biome-ignore lint/correctness/useExhaustiveDependencies: subject is read only to
  // seed an initial selection; listing it would refetch on every subject change.
  useEffect(() => {
    fetchSchemaSubjects(instrumentName)
      .then((data) => {
        setSubjects(data)
        if (data.length > 0 && !subject) {
          setSubject(data[0].name)
          setSchemaType(data[0].schemaType)
        }
      })
      .catch(() => {})
  }, [instrumentName])

  const handleCheck = async () => {
    if (!subject || !schema.trim()) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = await checkSchemaCompatibility(
        instrumentName,
        subject,
        schema,
        schemaType,
      )
      setResult(res)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="glass-card grid gap-3 p-4 md:grid-cols-2">
        <label className="space-y-1 text-xs text-zinc-500">
          Subject
          <select
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="block w-full rounded-md border border-dash-border bg-transparent px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
          >
            {subjects.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-zinc-500">
          Schema type
          <select
            value={schemaType}
            onChange={(e) => setSchemaType(e.target.value as SchemaType)}
            className="block w-full rounded-md border border-dash-border bg-transparent px-2 py-1.5 text-sm text-zinc-200 focus:outline-none"
          >
            {SCHEMA_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </label>
      </div>

      <textarea
        value={schema}
        onChange={(e) => setSchema(e.target.value)}
        placeholder="Paste candidate schema here..."
        rows={12}
        className="glass-card block w-full resize-y bg-transparent p-3 font-mono text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
      />

      <div className="flex justify-end">
        <button
          type="button"
          onClick={handleCheck}
          disabled={loading || !schema.trim() || !subject}
          className="inline-flex items-center gap-2 rounded-md bg-fr-coral px-3 py-1.5 text-xs font-medium text-white transition-opacity disabled:opacity-50"
        >
          {loading && <Loader2 className="size-3.5 animate-spin" />}
          Check compatibility
        </button>
      </div>

      {error && (
        <div className="glass-card p-3 text-xs text-job-failed">{error}</div>
      )}

      {result && <CompatibilityResultCard result={result} />}
    </div>
  )
}

function CompatibilityResultCard({ result }: { result: CompatibilityResult }) {
  const Icon = result.isCompatible ? CheckCircle2 : XCircle
  const tone = result.isCompatible
    ? "text-fr-emerald border-fr-emerald/30 bg-fr-emerald/5"
    : "text-job-failed border-job-failed/30 bg-job-failed/5"
  return (
    <div className={`glass-card border p-4 ${tone}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="size-4" />
        {result.isCompatible ? "Compatible" : "Incompatible"}
      </div>
      {result.messages.length > 0 && (
        <ul className="mt-3 space-y-1 text-xs">
          {result.messages.map((m) => (
            <li key={m} className="font-mono text-zinc-400">
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
