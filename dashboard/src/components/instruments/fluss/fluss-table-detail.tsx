import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchFlussTable } from "@/lib/instruments/api"
import type { FlussTableMetadata } from "@/lib/instruments/types"
import { FLUSS_TABLE_TYPE_BADGE, formatLastUpdated } from "./lib"

// FlussTableDetail renders the metadata grid (table type, buckets, keys,
// last-updated) and the schema viewer for a single Fluss table.
export function FlussTableDetail({
  instrumentName,
  database,
  table,
}: {
  instrumentName: string
  database: string
  table: string
}) {
  const [meta, setMeta] = useState<FlussTableMetadata | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchFlussTable(instrumentName, database, table)
      .then((data) => {
        setMeta(data)
        setError(null)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false))
  }, [instrumentName, database, table])

  if (loading) {
    return (
      <div className="glass-card flex items-center justify-center p-8">
        <Loader2 className="size-5 animate-spin text-zinc-500" />
      </div>
    )
  }

  if (error || !meta) {
    return (
      <div className="glass-card p-4 text-sm text-job-failed">
        {error ?? "table not found"}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="glass-card p-3">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-zinc-200">
            {meta.database}.{meta.name}
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              FLUSS_TABLE_TYPE_BADGE[meta.tableType] ??
              "bg-white/[0.08] text-zinc-300"
            }`}
          >
            {meta.tableType}
          </span>
          <span className="ml-auto text-xs text-zinc-500">
            {formatLastUpdated(meta.lastUpdatedMs)}
          </span>
        </div>
        {meta.comment ? (
          <p className="mt-2 text-xs text-zinc-400">{meta.comment}</p>
        ) : null}
      </div>

      <div className="glass-card grid grid-cols-1 gap-3 p-3 md:grid-cols-3">
        <MetaCell label="Bucket count" value={String(meta.bucketCount)} />
        <MetaCell
          label="Bucket key"
          value={meta.bucketKey?.length ? meta.bucketKey.join(", ") : "—"}
        />
        <MetaCell
          label="Primary key"
          value={meta.primaryKey?.length ? meta.primaryKey.join(", ") : "—"}
        />
      </div>

      <div className="glass-card overflow-hidden">
        <div className="border-b border-dash-border px-3 py-2 text-xs font-medium uppercase text-zinc-500">
          Schema
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border text-left text-zinc-500">
              <th className="px-3 py-2 font-medium">Column</th>
              <th className="px-3 py-2 font-medium">Type</th>
              <th className="px-3 py-2 font-medium">Nullable</th>
              <th className="px-3 py-2 font-medium">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-dash-border">
            {meta.schema.map((f) => (
              <tr key={f.name} className="hover:bg-white/[0.02]">
                <td className="px-3 py-1.5 font-mono text-zinc-200">
                  {f.name}
                </td>
                <td className="px-3 py-1.5 font-mono text-zinc-400">
                  {f.type}
                </td>
                <td className="px-3 py-1.5 text-zinc-500">
                  {f.nullable ? "yes" : "no"}
                </td>
                <td className="px-3 py-1.5 text-zinc-500">
                  {f.comment || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {Object.keys(meta.properties ?? {}).length > 0 ? (
        <div className="glass-card overflow-hidden">
          <div className="border-b border-dash-border px-3 py-2 text-xs font-medium uppercase text-zinc-500">
            Properties
          </div>
          <table className="w-full text-xs">
            <tbody className="divide-y divide-dash-border">
              {Object.entries(meta.properties).map(([k, v]) => (
                <tr key={k}>
                  <td className="w-1/3 px-3 py-1.5 font-mono text-zinc-400">
                    {k}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-zinc-300">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">
        {label}
      </div>
      <div className="mt-1 font-mono text-sm text-zinc-200">{value}</div>
    </div>
  )
}
