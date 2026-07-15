import {
  Activity,
  Clock,
  Database,
  Loader2,
  Server,
  Users,
  Zap,
} from "lucide-react"
import { useEffect, useState } from "react"
import { fetchRedisServerInfo } from "@/lib/instruments/api"
import type { RedisServerInfo } from "@/lib/instruments/types"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024)
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  return `${minutes}m`
}

function hitRate(info: RedisServerInfo): string {
  const total = info.keyspaceHits + info.keyspaceMisses
  if (total === 0) return "—"
  return `${((info.keyspaceHits / total) * 100).toFixed(1)}%`
}

export function ServerDashboard({
  instrumentName,
}: {
  instrumentName: string
}) {
  const [info, setInfo] = useState<RedisServerInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchRedisServerInfo(instrumentName)
      .then((data) => {
        setInfo(data)
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

  if (!info) return null

  const cards = [
    { label: "Version", value: info.version, Icon: Server },
    { label: "Uptime", value: formatUptime(info.uptime), Icon: Clock },
    {
      label: "Connected clients",
      value: info.connectedClients.toLocaleString(),
      Icon: Users,
    },
    {
      label: "Used memory",
      value: formatBytes(info.usedMemory),
      Icon: Database,
    },
    {
      label: "Total keys",
      value: info.totalKeys.toLocaleString(),
      Icon: Activity,
    },
    { label: "Hit rate", value: hitRate(info), Icon: Zap },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
      {cards.map(({ label, value, Icon }) => (
        <div key={label} className="glass-card p-4">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <Icon className="size-3.5" />
            {label}
          </div>
          <div className="mt-2 font-mono text-lg text-zinc-100">{value}</div>
        </div>
      ))}
    </div>
  )
}
