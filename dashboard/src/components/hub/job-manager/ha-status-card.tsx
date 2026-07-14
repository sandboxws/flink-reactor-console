/**
 * Hub Job Manager — High Availability status card.
 *
 * Observe-only surface derived from the cluster config (`high-availability.*`).
 * Enabled shows the HA type + storage dir + cluster id; disabled shows an
 * explicit "Disabled" state (never blank rows), so absent-by-config is
 * distinguishable from loading.
 */

import type { HAStatus } from "@flink-reactor/ui"
import { ShieldCheck, ShieldOff } from "lucide-react"
import { cn } from "@/lib/cn"

function Row({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-[11px] text-fg-faint">{label}</dt>
      <dd
        className={cn(
          "text-[13px] text-fg break-all",
          mono ? "font-mono text-[12px]" : "",
        )}
      >
        {value}
      </dd>
    </div>
  )
}

export function HaStatusCard({ ha }: { ha: HAStatus | null }) {
  if (!ha) return null

  const { enabled } = ha

  return (
    <div className="glass-card-static flex flex-col gap-3 p-4">
      <div className="flex items-center gap-2">
        {enabled ? (
          <ShieldCheck className="size-4 text-fr-sage" />
        ) : (
          <ShieldOff className="size-4 text-fg-faint" />
        )}
        <span className="font-sans text-[13px] font-medium text-zinc-100">
          High Availability
        </span>
        <span
          className={cn(
            "ml-auto rounded border border-dash-border px-2 py-0.5 font-mono text-[10px]",
            enabled ? "text-fr-sage" : "text-fg-muted",
          )}
        >
          {enabled ? "Enabled" : "Disabled"}
        </span>
      </div>

      {enabled ? (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
          <Row label="Type" value={ha.mode} />
          {ha.storageDir ? (
            <Row label="Storage directory" value={ha.storageDir} mono />
          ) : null}
          {ha.clusterId ? (
            <Row label="Cluster id" value={ha.clusterId} mono />
          ) : null}
        </dl>
      ) : (
        <p className="text-[12px] text-fg-muted">
          High availability is not configured for this cluster — failover relies
          on a single JobManager.
        </p>
      )}
    </div>
  )
}
