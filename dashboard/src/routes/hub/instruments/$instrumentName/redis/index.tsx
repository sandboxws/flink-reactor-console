/**
 * Hub Redis instrument index — /hub/instruments/$instrumentName/redis.
 *
 * Renders the key-scan browser. Server-info subtab is reachable via
 * the tab strip.
 */

import { HubBreadcrumb } from "@flink-reactor/ui"
import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import { RedisKeyBrowser } from "@/components/hub/instruments/redis-key-browser"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"

function HubRedisIndex() {
  const { instrumentName } = useParams({
    from: "/hub/instruments/$instrumentName/redis/",
  })
  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[
          { label: "Instruments", to: "/hub/instruments" },
          { label: instrumentName, mono: true },
          { label: "Redis" },
        ]}
        LinkComponent={HubLink}
      />
      <RedisSubTabs instrument={instrumentName} active="overview" />
      <div className="mt-5">
        <RedisKeyBrowser instrument={instrumentName} />
      </div>
    </HubAppShell>
  )
}

interface RedisSubTabsProps {
  instrument: string
  active: "overview" | "key" | "server"
}

export function RedisSubTabs({ instrument, active }: RedisSubTabsProps) {
  return (
    <div className="mt-3 flex items-center gap-1 border-b border-dash-border">
      <Link
        to="/hub/instruments/$instrumentName/redis"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "overview" ? "active" : ""}`}
      >
        Keys
      </Link>
      <Link
        to="/hub/instruments/$instrumentName/redis/server"
        params={{ instrumentName: instrument }}
        className={`tab ${active === "server" ? "active" : ""}`}
      >
        Server
      </Link>
      {active === "key" ? <span className="tab active">Key</span> : null}
    </div>
  )
}

export const Route = createFileRoute("/hub/instruments/$instrumentName/redis/")(
  {
    component: HubRedisIndex,
  },
)
