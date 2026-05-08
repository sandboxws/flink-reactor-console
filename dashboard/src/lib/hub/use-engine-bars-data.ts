/**
 * useEngineBarsData — driver for the Hub overview "Streaming engine" chart.
 *
 * Discovers a `numRecordsOutPerSecond` series via `metricCatalog`, fetches
 * the last `minutes` of data via `metricSeries`, and buckets the points
 * into one cell per minute. Returns `null` when the storage backend has
 * no metrics yet — the caller (overview route) falls back to seeded demo
 * bars in that case.
 *
 * Design notes:
 *  - Picks the FIRST catalog entry whose metricID ends in
 *    `numRecordsOutPerSecond` (case-insensitive). For multi-vertex jobs
 *    this is a representative — not a cluster sum. A cluster-wide sum
 *    would require fetching every vertex's series and summing within
 *    bucket, which is straightforward but burns an N-vertex query per
 *    refresh; deferred to a follow-up if needed.
 *  - Bucket aggregation uses MAX (peak throughput within the minute)
 *    rather than AVG/SUM. Peak reads more honestly for a bar chart that
 *    represents "instantaneous engine load."
 *  - `failed` flag is left false until checkpoint correlation is wired.
 *    Coloring all bars sage is more honest than fabricating failures.
 */

import { useEffect, useState } from "react"
import {
  fetchMetricCatalog,
  fetchMetricSeries,
  type MetricCatalogEntry,
  type MetricTimeSeries,
} from "@/lib/graphql-api-client"

export type EngineBar = {
  /** Bar height in pixels (0..180). */
  height: number
  /** Raw peak value within the bucket (e.g. peak rec/s). 0 when the bucket had no points. */
  value: number
  /** Start of the 1-minute bucket. */
  bucketStart: Date
  /** Whether this bucket overlaps a failed checkpoint. */
  failed: boolean
}

export type EngineBarsResult = {
  bars: EngineBar[]
  /** True until the first fetch completes. */
  loading: boolean
  /** True when no `numRecordsOutPerSecond` series exists in the catalog. */
  empty: boolean
  /** Error message from the most recent fetch, if any. */
  error: string | null
}

const DEFAULT_HEIGHT_PX = 180

/** Pick the first metric catalog entry whose ID looks like a per-second record count. */
function pickThroughputMetric(
  catalog: MetricCatalogEntry[],
): MetricCatalogEntry | null {
  return (
    catalog.find((m) => /numRecordsOutPerSecond$/i.test(m.metricID)) ?? null
  )
}

/** Bucket points into `bucketCount` 1-minute buckets, taking max value per bucket. */
function bucketizeMax(
  series: MetricTimeSeries[],
  windowStart: number,
  bucketCount: number,
): number[] {
  const buckets = new Array<number>(bucketCount).fill(0)
  for (const s of series) {
    for (const p of s.points) {
      const ts = Date.parse(p.capturedAt)
      if (Number.isNaN(ts)) continue
      const minuteIdx = Math.floor((ts - windowStart) / 60_000)
      if (minuteIdx < 0 || minuteIdx >= bucketCount) continue
      if (p.value > buckets[minuteIdx]) buckets[minuteIdx] = p.value
    }
  }
  return buckets
}

/** Scale raw values to bar heights, anchored on the window's peak. */
function scaleHeights(values: number[], maxHeight: number): number[] {
  const peak = Math.max(...values, 0)
  if (peak === 0) return values.map(() => 0)
  return values.map((v) => Math.round((v / peak) * maxHeight))
}

export function useEngineBarsData(
  clusterID: string | null | undefined,
  options: { minutes?: number; refreshIntervalMs?: number } = {},
): EngineBarsResult {
  const minutes = options.minutes ?? 38
  const refreshMs = options.refreshIntervalMs ?? 60_000

  const [bars, setBars] = useState<EngineBar[]>([])
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
        // Bound clusterID locally for TS narrowing inside the closure.
        if (!clusterID) return
        const catalog = await fetchMetricCatalog(clusterID)
        if (cancelled) return
        const pick = pickThroughputMetric(catalog)
        if (!pick) {
          setEmpty(true)
          setLoading(false)
          return
        }

        const before = new Date()
        const after = new Date(before.getTime() - minutes * 60_000)
        const series = await fetchMetricSeries({
          clusterID,
          series: [
            {
              sourceType: pick.sourceType,
              sourceID: pick.sourceID,
              metricID: pick.metricID,
            },
          ],
          after: after.toISOString(),
          before: before.toISOString(),
          maxPoints: minutes * 4,
        })
        if (cancelled) return

        // Quantize the window start to the minute boundary so bar i always
        // represents [start + i*60s, start + (i+1)*60s).
        const windowStart = Math.floor(after.getTime() / 60_000) * 60_000
        const raw = bucketizeMax(series, windowStart, minutes)
        const heights = scaleHeights(raw, DEFAULT_HEIGHT_PX)
        const bars: EngineBar[] = heights.map((h, i) => ({
          height: h,
          value: raw[i],
          bucketStart: new Date(windowStart + i * 60_000),
          failed: false,
        }))

        if (raw.every((v) => v === 0)) {
          setEmpty(true)
          setBars(bars)
        } else {
          setEmpty(false)
          setBars(bars)
        }
        setError(null)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to fetch metrics")
        setLoading(false)
      }
    }

    fetchOnce()
    const id = window.setInterval(fetchOnce, refreshMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [clusterID, minutes, refreshMs])

  return { bars, loading, empty, error }
}
