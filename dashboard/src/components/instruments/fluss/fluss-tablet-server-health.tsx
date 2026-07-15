import { CheckCircle2, Loader2, XCircle } from "lucide-react"
import { useEffect, useState } from "react"
import { fetchFlussTabletServers } from "@/lib/instruments/api"
import type { FlussTabletServerHealth as TabletHealth } from "@/lib/instruments/types"

// FlussTabletServerHealth renders a status grid for the cluster's
// TabletServers. Each card shows alive/dead state and the leadership count
// (number of bucket leaderships the server currently holds).
export function FlussTabletServerHealth({
  instrumentName,
}: {
  instrumentName: string
}) {
  const [servers, setServers] = useState<TabletHealth[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchFlussTabletServers(instrumentName)
      .then((data) => {
        setServers(data)
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

  if (servers.length === 0) {
    return (
      <div className="glass-card flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm text-zinc-500">No TabletServers reported</p>
      </div>
    )
  }

  const totalLeadership = servers.reduce((acc, s) => acc + s.leadership, 0)

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {servers.map((s) => {
        const share =
          totalLeadership > 0
            ? Math.round((s.leadership / totalLeadership) * 100)
            : 0
        return (
          <div
            key={s.server}
            className="glass-card flex items-center gap-3 p-3"
          >
            {s.alive ? (
              <CheckCircle2 className="size-5 text-emerald-400" />
            ) : (
              <XCircle className="size-5 text-job-failed" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate font-mono text-sm text-zinc-200">
                {s.server}
              </div>
              <div className="text-xs text-zinc-500">
                {s.alive ? "alive" : "dead"} · {s.leadership} leaderships (
                {share}%)
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
