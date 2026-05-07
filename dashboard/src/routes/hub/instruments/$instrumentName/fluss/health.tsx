/**
 * Hub Fluss tablet-server health — /hub/instruments/$instrumentName/fluss/health.
 *
 * Lists every TabletServer with its alive status and bucket-leadership
 * count. Status conveyed via background tint + dot, no left-border.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import { Server } from "lucide-react"
import { useEffect, useState } from "react"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import {
  type FlussTabletServerHealth,
  fetchFlussTabletServers,
} from "@/lib/instruments-data"
import { FlussSubTabs } from "./index"

function HubFlussHealth() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/fluss/health",
  })
  const [servers, setServers] = useState<FlussTabletServerHealth[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchFlussTabletServers(instrumentName)
      .then((list) => {
        if (!cancelled) setServers(list)
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load servers")
          setServers([])
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
            label: "Fluss",
            to: "/hub/instruments/$instrumentName/fluss".replace(
              "$instrumentName",
              instrumentName,
            ),
          },
          { label: "Health" },
        ]}
        LinkComponent={HubLink}
      />
      <FlussSubTabs instrument={instrumentName} active="health" />

      <div className="mt-5">
        {error ? (
          <p className="text-[11.5px] text-fr-rose font-mono">{error}</p>
        ) : servers === null ? (
          <p className="text-[11.5px] font-mono text-fg-faint">Loading…</p>
        ) : servers.length === 0 ? (
          <p className="text-[12px] text-fg-muted">
            No tablet servers reported.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {servers.map((s) => (
              <article
                key={s.server}
                className={
                  s.alive
                    ? "glass-card-static p-4"
                    : "glass-card-static border-fr-rose/30 bg-fr-rose/[0.03] p-4"
                }
              >
                <div className="flex items-center gap-2">
                  <Server
                    className={
                      s.alive ? "size-4 text-fr-sage" : "size-4 text-fr-rose"
                    }
                  />
                  <h3 className="font-mono text-[13px] text-zinc-100 truncate">
                    {s.server}
                  </h3>
                  <span
                    className={
                      s.alive
                        ? "ml-auto sev-badge ok"
                        : "ml-auto sev-badge fail"
                    }
                  >
                    {s.alive ? "alive" : "down"}
                  </span>
                </div>
                <dl className="mt-3 space-y-1 text-[11.5px]">
                  <div className="flex justify-between gap-3">
                    <dt className="text-fg-muted">Leaderships</dt>
                    <dd className="font-mono text-fg">{s.leadership}</dd>
                  </div>
                </dl>
              </article>
            ))}
          </div>
        )}
      </div>
    </HubAppShell>
  )
}

export const Route = createFileRoute(
  "/hub/instruments/$instrumentName/fluss/health",
)({
  component: HubFlussHealth,
})
