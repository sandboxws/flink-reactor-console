import {
  AlertTriangle,
  Clock,
  Database,
  Hash,
  Key,
  Loader2,
} from "lucide-react"
import { useEffect, useState } from "react"
import { fetchRedisKeyInfo, fetchRedisKeyValue } from "@/lib/instruments/api"
import type { RedisKeyInfo, RedisKeyValue } from "@/lib/instruments/types"

const TYPE_BADGE_CLASS: Record<string, string> = {
  string: "bg-fr-coral/15 text-fr-coral",
  hash: "bg-fr-amber/15 text-fr-amber",
  list: "bg-fr-purple/15 text-fr-purple",
  set: "bg-fr-emerald/15 text-fr-emerald",
  zset: "bg-fr-blue/15 text-fr-blue",
}

function formatTTL(ttl: number): string {
  if (ttl === -1) return "no expiry"
  if (ttl === -2) return "expired"
  if (ttl < 60) return `${ttl}s`
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`
  return `${Math.floor(ttl / 86400)}d`
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

export function ValueInspector({
  instrumentName,
  redisKey,
}: {
  instrumentName: string
  redisKey: string
}) {
  const [info, setInfo] = useState<RedisKeyInfo | null>(null)
  const [value, setValue] = useState<RedisKeyValue | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchRedisKeyInfo(instrumentName, redisKey),
      fetchRedisKeyValue(instrumentName, redisKey),
    ])
      .then(([i, v]) => {
        setInfo(i)
        setValue(v)
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : String(err)),
      )
      .finally(() => setLoading(false))
  }, [instrumentName, redisKey])

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

  if (!info || !value) return null

  const badgeClass =
    TYPE_BADGE_CLASS[info.type] ?? "bg-white/[0.08] text-zinc-300"

  return (
    <div className="space-y-3">
      <div className="glass-card flex flex-wrap items-center gap-3 p-3">
        <Key className="size-4 text-zinc-400" />
        <span className="break-all font-mono text-sm text-zinc-200">
          {info.key}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-medium uppercase ${badgeClass}`}
        >
          {info.type}
        </span>
        <div className="ml-auto flex items-center gap-3 text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <Clock className="size-3" /> {formatTTL(info.ttl)}
          </span>
          <span className="flex items-center gap-1">
            <Database className="size-3" /> {formatBytes(info.memoryUsage)}
          </span>
          {info.encoding && (
            <span className="flex items-center gap-1">
              <Hash className="size-3" /> {info.encoding}
            </span>
          )}
        </div>
      </div>

      {value.truncated && (
        <div className="flex items-center gap-2 rounded-md border border-fr-amber/30 bg-fr-amber/5 px-3 py-2 text-xs text-fr-amber">
          <AlertTriangle className="size-3.5" />
          Value truncated. Total size: {value.totalSize.toLocaleString()}.
        </div>
      )}

      <div className="glass-card overflow-hidden">
        {value.type === "string" && (
          <StringValue value={value.stringValue ?? ""} />
        )}
        {value.type === "hash" && <HashValue entries={value.hashValue ?? []} />}
        {value.type === "list" && <ListValue items={value.listValue ?? []} />}
        {value.type === "set" && <SetValue members={value.setValue ?? []} />}
        {value.type === "zset" && <ZSetValue entries={value.zsetValue ?? []} />}
      </div>
    </div>
  )
}

function StringValue({ value }: { value: string }) {
  return (
    <pre className="overflow-auto whitespace-pre-wrap break-all p-3 font-mono text-xs text-zinc-200">
      {value}
    </pre>
  )
}

function HashValue({
  entries,
}: {
  entries: { field: string; value: string }[]
}) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500">Empty hash</div>
    )
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-dash-border text-left text-zinc-500">
          <th className="px-3 py-2 font-medium">Field</th>
          <th className="px-3 py-2 font-medium">Value</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dash-border">
        {entries.map((e) => (
          <tr key={e.field} className="hover:bg-white/[0.02]">
            <td className="px-3 py-1.5 font-mono text-zinc-200">{e.field}</td>
            <td className="px-3 py-1.5 font-mono text-zinc-400 break-all">
              {e.value}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ListValue({ items }: { items: string[] }) {
  if (items.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500">Empty list</div>
    )
  }
  return (
    <ol className="divide-y divide-dash-border">
      {items.map((item, idx) => (
        // eslint-disable-next-line react/no-array-index-key
        <li key={idx} className="flex gap-3 px-3 py-1.5 text-xs">
          <span className="w-10 text-right font-mono text-zinc-600">{idx}</span>
          <span className="flex-1 break-all font-mono text-zinc-200">
            {item}
          </span>
        </li>
      ))}
    </ol>
  )
}

function SetValue({ members }: { members: string[] }) {
  if (members.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500">Empty set</div>
    )
  }
  return (
    <div className="flex flex-wrap gap-1.5 p-3">
      {members.map((m) => (
        <span
          key={m}
          className="rounded-md bg-white/[0.06] px-2 py-1 font-mono text-xs text-zinc-200"
        >
          {m}
        </span>
      ))}
    </div>
  )
}

function ZSetValue({
  entries,
}: {
  entries: { member: string; score: number }[]
}) {
  if (entries.length === 0) {
    return (
      <div className="p-4 text-center text-xs text-zinc-500">Empty zset</div>
    )
  }
  return (
    <table className="w-full text-xs">
      <thead>
        <tr className="border-b border-dash-border text-left text-zinc-500">
          <th className="px-3 py-2 font-medium">Score</th>
          <th className="px-3 py-2 font-medium">Member</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-dash-border">
        {entries.map((e) => (
          <tr key={e.member} className="hover:bg-white/[0.02]">
            <td className="w-32 px-3 py-1.5 font-mono text-fr-blue">
              {e.score}
            </td>
            <td className="px-3 py-1.5 font-mono text-zinc-200 break-all">
              {e.member}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
