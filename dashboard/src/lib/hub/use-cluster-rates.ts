/**
 * useClusterRates — cluster-wide Throughput + Watermark-lag rollups.
 *
 * Discovers all `numRecordsOutPerSecond` and `currentInputWatermark` entries
 * via `metricCatalog`, fetches the most recent 60-second window for each,
 * and rolls up:
 *  - throughput = Σ latest non-null value across `numRecordsOutPerSecond`
 *  - watermarkLagMs = `Date.now() − min(latest watermark)` clamped to ≥ 0
 *
 * Returns `null` for either value when no catalog entries match or storage
 * has not yet seen a sample.
 *
 * This is the interim rollup used until `fr-console-v2-server-job-throughput-rollup`
 * lands `recordsOutPerSecond` + `watermarkLag` directly on `JobOverview`.
 */

import { useEffect, useState } from "react"
import {
  fetchMetricCatalog,
  fetchMetricSeries,
  type MetricCatalogEntry,
} from "@/lib/graphql-api-client"

export type ClusterRatesResult = {
  /** Cluster-wide throughput in records/sec. Null when no data. */
  throughput: number | null
  /** Worst-case watermark lag in ms. Null when no data. */
  watermarkLagMs: number | null
  /** True until the first fetch completes. */
  loading: boolean
  /** True when catalog has no matching metrics yet. */
  empty: boolean
  /** Most recent fetch error, if any. */
  error: string | null
}

const THROUGHPUT_RE = /numRecordsOutPerSecond$/i
const WATERMARK_RE = /currentInputWatermark$/i

function pickEntries(
  catalog: MetricCatalogEntry[],
  pattern: RegExp,
): MetricCatalogEntry[] {
  return catalog.filter((m) => pattern.test(m.metricID))
}

/** Latest non-null value across a list of series (one per source). */
function latestSum(series: { points: { value: number }[] }[]): number | null {
  let sum = 0
  let found = false
  for (const s of series) {
    if (s.points.length === 0) continue
    const last = s.points[s.points.length - 1]
    if (!Number.isFinite(last.value)) continue
    sum += last.value
    found = true
  }
  return found ? sum : null
}

/** Smallest latest value across watermark series — represents the slowest source. */
function latestMin(series: { points: { value: number }[] }[]): number | null {
  let min: number | null = null
  for (const s of series) {
    if (s.points.length === 0) continue
    const last = s.points[s.points.length - 1]
    if (!Number.isFinite(last.value)) continue
    if (min === null || last.value < min) min = last.value
  }
  return min
}

export function useClusterRates(
  clusterID: string | null | undefined,
  options: { refreshIntervalMs?: number; windowSec?: number } = {},
): ClusterRatesResult {
  const refreshMs = options.refreshIntervalMs ?? 5_000
  const windowSec = options.windowSec ?? 60

  const [throughput, setThroughput] = useState<number | null>(null)
  const [watermarkLagMs, setWatermarkLagMs] = useState<number | null>(null)
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
        const catalog = await fetchMetricCatalog(clusterID)
        if (cancelled) return

        const throughputEntries = pickEntries(catalog, THROUGHPUT_RE)
        const watermarkEntries = pickEntries(catalog, WATERMARK_RE)

        if (throughputEntries.length === 0 && watermarkEntries.length === 0) {
          setEmpty(true)
          setLoading(false)
          return
        }

        const before = new Date()
        const after = new Date(before.getTime() - windowSec * 1000)
        const allEntries = [...throughputEntries, ...watermarkEntries]
        const series = await fetchMetricSeries({
          clusterID,
          series: allEntries.map((m) => ({
            sourceType: m.sourceType,
            sourceID: m.sourceID,
            metricID: m.metricID,
          })),
          after: after.toISOString(),
          before: before.toISOString(),
          maxPoints: 4 * allEntries.length,
        })
        if (cancelled) return

        const throughputSeries = series.filter((s) =>
          THROUGHPUT_RE.test(s.metricID),
        )
        const watermarkSeries = series.filter((s) =>
          WATERMARK_RE.test(s.metricID),
        )

        const sumThroughput = latestSum(throughputSeries)
        const minWatermark = latestMin(watermarkSeries)

        const lag =
          minWatermark === null
            ? null
            : Math.max(0, before.getTime() - minWatermark)

        setThroughput(sumThroughput)
        setWatermarkLagMs(lag)
        setEmpty(sumThroughput === null && lag === null)
        setError(null)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : "Failed to fetch rates")
        setLoading(false)
      }
    }

    fetchOnce()
    const id = window.setInterval(fetchOnce, refreshMs)
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [clusterID, refreshMs, windowSec])

  return { throughput, watermarkLagMs, loading, empty, error }
}
