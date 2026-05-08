/**
 * useCheckpointDensity — driver for the Hub overview checkpoint heatmap.
 *
 * Pulls the last `days` of checkpoint records from `checkpointHistory`
 * and aggregates per-day counts into a `HeatmapIntensity[]` of length
 * `days`. Returns `null` when storage is unavailable so the caller can
 * fall back to seeded demo data.
 *
 * Design notes:
 *  - Day buckets use the BROWSER's local timezone for visual alignment
 *    with the user's "today is on the right" expectation. Server returns
 *    RFC3339 timestamps; we convert with `toLocaleDateString` keyed on
 *    YYYY-MM-DD via toISOString, then offset.
 *  - Intensity is computed from QUARTILES of non-zero day counts in the
 *    window — not fixed thresholds. This self-calibrates to whatever
 *    cadence the live job runs at: a job checkpointing once a minute
 *    (~1440/day) and a job checkpointing once an hour (~24/day) both
 *    produce a varied 0..4 distribution rather than saturating at 4.
 *    A zero-count day is always intensity 0.
 *  - Failed checkpoints count the same as successful ones — the heatmap
 *    is a density signal, not a health signal. (A red overlay for
 *    failed-dominated days would be a nice future enhancement.)
 */

import type { HeatmapIntensity } from "@flink-reactor/ui"
import { useEffect, useState } from "react"
import {
  fetchCheckpointHistory,
  type StoredCheckpoint,
} from "@/lib/graphql-api-client"

export type CheckpointDensityResult = {
  data: HeatmapIntensity[]
  /** True until the first fetch completes. */
  loading: boolean
  /** True when the storage query returned zero records. */
  empty: boolean
  /** Error message from the most recent fetch, if any. */
  error: string | null
}

/**
 * Map a series of per-day counts to 5-step intensities using quartiles of
 * the non-zero counts. Self-calibrates to the job's cadence so the heatmap
 * is always visually varied rather than saturating one direction.
 */
function quantileIntensities(counts: number[]): HeatmapIntensity[] {
  const nonZero = counts.filter((c) => c > 0).sort((a, b) => a - b)
  if (nonZero.length === 0) return counts.map(() => 0) as HeatmapIntensity[]
  const q1 = nonZero[Math.floor(nonZero.length * 0.25)]
  const q2 = nonZero[Math.floor(nonZero.length * 0.5)]
  const q3 = nonZero[Math.floor(nonZero.length * 0.75)]
  return counts.map((c) => {
    if (c === 0) return 0
    if (c <= q1) return 1
    if (c <= q2) return 2
    if (c <= q3) return 3
    return 4
  }) as HeatmapIntensity[]
}

/** Return YYYY-MM-DD in the BROWSER's local timezone for consistent day bucketing. */
function localDayKey(d: Date): string {
  const y = d.getFullYear()
  const m = (d.getMonth() + 1).toString().padStart(2, "0")
  const day = d.getDate().toString().padStart(2, "0")
  return `${y}-${m}-${day}`
}

/** Build an ordered list of `days` day-keys ending at today (inclusive). */
function buildDayKeys(days: number): string[] {
  const out: string[] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000)
    out.push(localDayKey(d))
  }
  return out
}

/** Aggregate raw checkpoints into per-day buckets. */
function aggregate(
  checkpoints: StoredCheckpoint[],
  dayKeys: string[],
): HeatmapIntensity[] {
  const counts = new Map<string, number>()
  for (const ck of checkpoints) {
    const ts = ck.triggerTimestamp ?? ck.capturedAt
    const parsed = new Date(ts)
    if (Number.isNaN(parsed.getTime())) continue
    const key = localDayKey(parsed)
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const counted = dayKeys.map((k) => counts.get(k) ?? 0)
  return quantileIntensities(counted)
}

export function useCheckpointDensity(
  clusterID: string | null | undefined,
  options: { days?: number; refreshIntervalMs?: number } = {},
): CheckpointDensityResult {
  const days = options.days ?? 26 * 7
  const refreshMs = options.refreshIntervalMs ?? 5 * 60_000

  const [data, setData] = useState<HeatmapIntensity[]>([])
  const [loading, setLoading] = useState(true)
  const [empty, setEmpty] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clusterID) {
      setLoading(false)
      setEmpty(true)
      return
    }

    let cancelled = false

    async function fetchOnce() {
      try {
        if (!clusterID) return
        const before = new Date()
        const after = new Date(before.getTime() - days * 24 * 60 * 60 * 1000)
        const checkpoints = await fetchCheckpointHistory({
          clusterID,
          after: after.toISOString(),
          before: before.toISOString(),
          maxRecords: 5000,
        })
        if (cancelled) return

        const dayKeys = buildDayKeys(days)
        const aggregated = aggregate(checkpoints, dayKeys)
        setData(aggregated)
        setEmpty(checkpoints.length === 0)
        setError(null)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to fetch checkpoints")
        setLoading(false)
      }
    }

    fetchOnce()
    const id = window.setInterval(fetchOnce, refreshMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [clusterID, days, refreshMs])

  return { data, loading, empty, error }
}
