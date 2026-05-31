/**
 * State Manifest version history with a two-version compare.
 *
 * Lists stored manifest versions (newest first); selecting any two renders a
 * `<StateFingerprintDiff>` of their canonical manifests. Defaults to comparing
 * the latest two versions when at least two exist.
 */

import { EmptyState } from "@flink-reactor/ui"
import { History } from "lucide-react"
import { useMemo, useState } from "react"
import { StateFingerprintDiff } from "@/components/hub/deployments/state-fingerprint-diff"
import type { PipelineManifestVersion } from "@/data/compatibility-types"
import { shortFingerprint } from "@/data/compatibility-types"
import { cn } from "@/lib/cn"

interface ManifestVersionHistoryProps {
  versions: PipelineManifestVersion[]
  loading: boolean
  error: string | null
}

export function ManifestVersionHistory({
  versions,
  loading,
  error,
}: ManifestVersionHistoryProps) {
  // Default selection: latest two versions (versions arrive newest-first).
  const [selected, setSelected] = useState<number[] | null>(null)

  const effectiveSelection = useMemo<number[]>(() => {
    if (selected) return selected
    if (versions.length >= 2) return [versions[1].version, versions[0].version]
    return []
  }, [selected, versions])

  function toggle(version: number) {
    const cur = effectiveSelection
    if (cur.includes(version)) {
      setSelected(cur.filter((v) => v !== version))
    } else if (cur.length < 2) {
      setSelected([...cur, version])
    } else {
      // Drop the oldest selection, keep the most recent + the new one.
      setSelected([cur[1], version])
    }
  }

  const diffPair = useMemo(() => {
    if (effectiveSelection.length !== 2) return null
    const picked = versions
      .filter((v) => effectiveSelection.includes(v.version))
      .sort((a, b) => a.version - b.version)
    if (picked.length !== 2) return null
    return { older: picked[0], newer: picked[1] }
  }, [effectiveSelection, versions])

  if (loading && versions.length === 0) {
    return <div className="h-24 animate-pulse rounded bg-dash-surface/40" />
  }
  if (error) {
    return (
      <div className="rounded border border-fr-coral/30 bg-dash-surface p-4 text-[12px] text-fr-coral">
        Failed to load manifest versions: {error}
      </div>
    )
  }
  if (versions.length === 0) {
    return (
      <EmptyState
        icon={History}
        message="No State Manifest versions pushed for this pipeline yet."
      />
    )
  }

  return (
    <div>
      <p className="mb-2 text-[11px] text-fg-muted">
        Select two versions to compare their canonical manifests.
      </p>
      <div className="overflow-hidden rounded-md border border-dash-border">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr_1.4fr] gap-2 bg-dash-surface px-3 py-2 text-[10px] font-medium uppercase tracking-wider text-fg-faint">
          <span>Ver</span>
          <span>Fingerprint</span>
          <span>Flink</span>
          <span>Source</span>
          <span>Created</span>
        </div>
        {versions.map((v) => {
          const isSelected = effectiveSelection.includes(v.version)
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => toggle(v.version)}
              className={cn(
                "grid w-full grid-cols-[auto_1fr_1fr_1fr_1.4fr] items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors",
                isSelected ? "bg-dash-elevated" : "hover:bg-dash-surface/60",
              )}
              aria-pressed={isSelected}
            >
              <span className="font-mono text-zinc-100">v{v.version}</span>
              <span className="truncate font-mono text-fg-muted">
                {shortFingerprint(v.stateFingerprint)}
              </span>
              <span className="truncate font-mono text-fg-muted">
                {v.flinkVersion ?? "—"}
              </span>
              <span className="truncate text-fg-muted">{v.source}</span>
              <span className="truncate font-mono text-[10px] text-fg-faint">
                {new Date(v.createdAt).toLocaleString()}
              </span>
            </button>
          )
        })}
      </div>

      {diffPair ? (
        <StateFingerprintDiff older={diffPair.older} newer={diffPair.newer} />
      ) : null}
    </div>
  )
}
