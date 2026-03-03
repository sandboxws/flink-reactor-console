// ---------------------------------------------------------------------------
// Tap manifest loader — fetches and parses tap manifest from the API route,
// provides helpers for building runtime observation SQL.
// ---------------------------------------------------------------------------

import type { TapManifest, TapMetadata } from "@/data/tap-types"

/** Load tap manifest for a pipeline by name (matches the Flink job name set via pipeline.name) */
export async function loadTapManifest(
  pipelineName: string,
): Promise<TapManifest> {
  const res = await fetch(
    `/api/flink/tap-manifest?pipeline=${encodeURIComponent(pipelineName)}`,
  )

  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(err.error ?? `Failed to load tap manifest: ${res.status}`)
  }

  return (await res.json()) as TapManifest
}

/** Component type ordering for grouped display */
const COMPONENT_TYPE_ORDER: Record<string, number> = {
  source: 0,
  transform: 1,
  join: 2,
  window: 3,
  sink: 4,
}

/** Extract operators available for tapping, sorted by component type */
export function getAvailableOperators(manifest: TapManifest): TapMetadata[] {
  return [...manifest.taps].sort((a, b) => {
    const aOrder = COMPONENT_TYPE_ORDER[a.componentType] ?? 99
    const bOrder = COMPONENT_TYPE_ORDER[b.componentType] ?? 99
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  })
}

/**
 * Build observation SQL with runtime overrides.
 *
 * Takes the base observation SQL from the manifest and modifies:
 * - Consumer group ID: appends session-unique suffix
 * - Offset mode: overrides scan.startup.mode
 * - Timestamps: adds scan.startup.timestamp-millis when in timestamp mode
 */
export function buildRuntimeObservationSql(
  metadata: TapMetadata,
  overrides: {
    offsetMode: "latest" | "earliest" | "timestamp"
    startTimestamp?: string
    endTimestamp?: string
    sessionId: string
  },
): string {
  let sql = metadata.observationSql

  // Override consumer group ID with session-unique suffix
  const sessionGroupId = `${metadata.consumerGroupId}-${overrides.sessionId}`
  sql = sql.replace(
    /'properties\.group\.id'\s*=\s*'[^']*'/,
    `'properties.group.id' = '${sessionGroupId}'`,
  )

  // Override offset mode
  const flinkStartupMode = mapOffsetMode(overrides.offsetMode)
  sql = sql.replace(
    /'scan\.startup\.mode'\s*=\s*'[^']*'/,
    `'scan.startup.mode' = '${flinkStartupMode}'`,
  )

  // Handle timestamp mode
  if (overrides.offsetMode === "timestamp" && overrides.startTimestamp) {
    const timestampMillis = new Date(overrides.startTimestamp).getTime()
    // Replace existing timestamp-millis or add it after scan.startup.mode
    if (sql.includes("scan.startup.timestamp-millis")) {
      sql = sql.replace(
        /'scan\.startup\.timestamp-millis'\s*=\s*'[^']*'/,
        `'scan.startup.timestamp-millis' = '${timestampMillis}'`,
      )
    } else {
      sql = sql.replace(
        /('scan\.startup\.mode'\s*=\s*'[^']*')/,
        `$1,\n  'scan.startup.timestamp-millis' = '${timestampMillis}'`,
      )
    }
  }

  return sql
}

/** Map offset mode to Flink scan.startup.mode values */
function mapOffsetMode(mode: "latest" | "earliest" | "timestamp"): string {
  switch (mode) {
    case "latest":
      return "latest-offset"
    case "earliest":
      return "earliest-offset"
    case "timestamp":
      return "timestamp"
  }
}
