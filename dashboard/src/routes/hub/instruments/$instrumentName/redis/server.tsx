/**
 * Hub Redis server info — /hub/instruments/$instrumentName/redis/server.
 *
 * Renders version, uptime, client count, memory, and hit/miss ratio
 * from `redisServerInfo`.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import {
  fetchRedisServerInfo,
  type RedisServerInfo,
} from "@/lib/instruments-data"
import { RedisSubTabs } from "./index"

function HubRedisServer() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/redis/server",
  })
  const [info, setInfo] = useState<RedisServerInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchRedisServerInfo(instrumentName)
      .then((i) => {
        if (!cancelled) setInfo(i)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load")
          setInfo(null)
        }
      })
    return () => {
      cancelled = true
    }
  }, [instrumentName])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          {
            label: "Redis",
            to: "/hub/instruments/$instrumentName/redis".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: "Server" },
        ]}
        LinkComponent={HubLink}
      />
      <RedisSubTabs instrument={instrumentName} active="server" />

      <div className="mt-5">
        {error ? (
          <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
        ) : !info ? (
          <p className="text-[11.5px] font-mono text-fg-faint">Loading…</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Kpi label="Version" value={info.version || "—"} />
            <Kpi
              label="Uptime"
              value={`${Math.floor(info.uptime / 86400)}d ${Math.floor((info.uptime % 86400) / 3600)}h`}
            />
            <Kpi
              label="Clients"
              value={info.connectedClients.toLocaleString()}
            />
            <Kpi
              label="Memory"
              value={`${(info.usedMemory / (1024 * 1024)).toFixed(1)} MB`}
            />
            <Kpi label="Total keys" value={info.totalKeys.toLocaleString()} />
            <Kpi label="Hits" value={info.keyspaceHits.toLocaleString()} />
            <Kpi label="Misses" value={info.keyspaceMisses.toLocaleString()} />
            <Kpi
              label="Hit ratio"
              value={`${(
                (info.keyspaceHits /
                  Math.max(1, info.keyspaceHits + info.keyspaceMisses)) *
                  100
              ).toFixed(1)}%`}
            />
          </div>
        )}
      </div>
    </HubAppShell>
  )
}

function Kpi({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="font-mono text-[14px] text-fg">{value}</div>
    </div>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/redis/server",
)({
  component: HubRedisServer,
})
