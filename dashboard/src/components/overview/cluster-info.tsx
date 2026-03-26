/**
 * @module cluster-info
 *
 * Displays the Flink cluster version, truncated commit hash, and optional
 * capability badges in a compact info bar at the top of the overview page.
 */

import { Info } from "lucide-react"

/**
 * Horizontal info bar showing Flink version metadata and cluster capabilities.
 *
 * The commit ID is truncated to the first 7 characters. Capabilities (e.g.,
 * "SQL", "STREAMING") render as individually-badged tags when present.
 */
export function ClusterInfo({
  version,
  commitId,
  capabilities,
}: {
  /** Flink version string (e.g., "1.20.0"). */
  version: string
  /** Full Git commit hash of the Flink build. */
  commitId: string
  /** Optional list of cluster capability names rendered as badges. */
  capabilities?: string[]
}) {
  return (
    <div className="flex items-center gap-3 rounded-lg bg-dash-elevated/50 px-4 py-2 text-xs text-zinc-500">
      <Info className="size-3.5 shrink-0" />
      <span>
        Flink <span className="font-medium text-zinc-300">{version}</span>
      </span>
      <span className="text-dash-border">|</span>
      <span className="font-mono">{commitId.slice(0, 7)}</span>
      {capabilities && capabilities.length > 0 && (
        <>
          <span className="text-dash-border">|</span>
          <div className="flex items-center gap-1.5">
            {capabilities.map((cap) => (
              <span
                key={cap}
                className="rounded bg-fr-purple/15 px-1.5 py-0.5 text-[10px] font-medium text-fr-purple"
              >
                {cap}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
