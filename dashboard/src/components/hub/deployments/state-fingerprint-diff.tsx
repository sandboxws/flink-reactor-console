/**
 * Structural diff between two State Manifest versions.
 *
 * The DSL canonicalizes each manifest with sorted keys before hashing
 * (state-collision-01), so pretty-printing the stored JSON yields a stable,
 * line-diffable rendering — the `<DiffViewer>` then surfaces added/removed/
 * changed operators, key fields, and changelog modes line-by-line.
 */

import { DiffViewer } from "@flink-reactor/ui"
import type { PipelineManifestVersion } from "@/data/compatibility-types"
import { shortFingerprint } from "@/data/compatibility-types"

interface StateFingerprintDiffProps {
  /** Older version (rendered as the "before" / removed side). */
  older: PipelineManifestVersion
  /** Newer version (rendered as the "after" / added side). */
  newer: PipelineManifestVersion
}

/** Pretty-print canonical manifest JSON; fall back to the raw string. */
function pretty(json: string): string {
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

export function StateFingerprintDiff({
  older,
  newer,
}: StateFingerprintDiffProps) {
  return (
    <div className="mt-3">
      <div className="mb-2 flex items-center gap-2 text-[11px] text-fg-muted">
        <span className="font-mono">
          v{older.version}{" "}
          <span className="text-fg-faint">
            ({shortFingerprint(older.stateFingerprint)})
          </span>
        </span>
        <span className="text-fg-faint">→</span>
        <span className="font-mono">
          v{newer.version}{" "}
          <span className="text-fg-faint">
            ({shortFingerprint(newer.stateFingerprint)})
          </span>
        </span>
      </div>
      <DiffViewer
        a={pretty(older.manifestJson)}
        b={pretty(newer.manifestJson)}
      />
    </div>
  )
}
