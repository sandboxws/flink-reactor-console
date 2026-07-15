import { Loader2 } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchRedisMemoryStats } from "../../api"
import type { RedisMemoryStats } from "../../types"

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function MemoryChart({
  instrumentName,
}: {
  instrumentName: string
}) {
  const [stats, setStats] = useState<RedisMemoryStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchRedisMemoryStats(instrumentName)
      .then((data) => {
        setStats(data)
        setError(null)
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
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

  if (!stats) return null

  // Bar chart: dataset, overhead, fragmentation slack (rss - used)
  const slack = Math.max(stats.rss - stats.usedMemory, 0)
  const segments = [
    { label: "Dataset", value: stats.datasetSize, color: "bg-fr-coral" },
    { label: "Overhead", value: stats.overhead, color: "bg-fr-amber" },
    { label: "Fragmentation", value: slack, color: "bg-fr-purple/60" },
  ]
  const total = segments.reduce((sum, s) => sum + s.value, 0) || 1

  const peakRatio = stats.peakMemory > 0 ? Math.min(stats.usedMemory / stats.peakMemory, 1) : 0

  return (
    <div className="space-y-4">
      <div className="glass-card space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Memory breakdown</span>
          <span>RSS {formatBytes(stats.rss)}</span>
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-white/[0.04]">
          {segments.map((s) => (
            <div
              key={s.label}
              className={s.color}
              style={{ width: `${(s.value / total) * 100}%` }}
              title={`${s.label}: ${formatBytes(s.value)}`}
            />
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3 text-xs">
          {segments.map((s) => (
            <div key={s.label} className="flex items-center gap-2">
              <span className={`size-2 rounded-full ${s.color}`} />
              <span className="text-zinc-500">{s.label}</span>
              <span className="ml-auto font-mono text-zinc-200">
                {formatBytes(s.value)}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="glass-card space-y-3 p-4">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <span>Peak vs current</span>
          <span className="font-mono text-zinc-300">
            {formatBytes(stats.usedMemory)} / {formatBytes(stats.peakMemory)}
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white/[0.04]">
          <div
            className="h-full bg-fr-blue"
            style={{ width: `${peakRatio * 100}%` }}
          />
        </div>
      </div>

      <div className="glass-card grid grid-cols-2 gap-3 p-4 text-xs md:grid-cols-3">
        <Stat label="Fragmentation ratio" value={stats.fragmentationRatio.toFixed(2)} />
        <Stat label="Allocator" value={stats.allocator || "—"} />
        <Stat label="Used memory" value={formatBytes(stats.usedMemory)} />
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500">{label}</div>
      <div className="mt-1 font-mono text-sm text-zinc-200">{value}</div>
    </div>
  )
}
