/**
 * useCheckpointFailureBuckets — per-minute failed-checkpoint counts.
 *
 * Queries `checkpointHistory` filtered to `status = FAILED` for the last
 * `minutes` of activity, then buckets each entry by floor-to-minute. The
 * returned map keys are bucket-start timestamps in ms (same epoch the
 * `useEngineBarsData` bars carry on their `bucketStart` field), letting
 * callers do `bucketCounts.get(bar.bucketStart.getTime())` to decide
 * whether a bar's minute had any failures.
 *
 * Design notes:
 *  - Floor-to-minute is shared with `useEngineBarsData` so the maps align
 *    pixel-for-pixel with the bars.
 *  - The fetch is intentionally narrow (`status: "FAILED"`) so we don't
 *    page through completed checkpoints we'd discard anyway.
 *  - `maxRecords` is bounded to 500 — for a 38-minute window even a
 *    high-frequency job (1/sec) tops out near 2280, but a healthy cluster
 *    is well under 500. Truncation just means the oldest bucket caps;
 *    the overlay is a boolean ("any failure?"), not a count, so this is fine.
 */

import { useEffect, useState } from "react"
import { fetchCheckpointHistory } from "@/lib/graphql-api-client"

export type CheckpointFailureBucketsResult = {
  /** Map of bucket-start (ms epoch, floored to minute) → failure count. */
  buckets: Map<number, number>
  /** True until the first fetch completes. */
  loading: boolean
  /** Error message from the most recent fetch, if any. */
  error: string | null
}

const EMPTY_BUCKETS: Map<number, number> = new Map()

export function useCheckpointFailureBuckets(
  clusterID: string | null | undefined,
  options: { minutes?: number; refreshIntervalMs?: number } = {},
): CheckpointFailureBucketsResult {
  const minutes = options.minutes ?? 38
  const refreshMs = options.refreshIntervalMs ?? 30_000

  const [buckets, setBuckets] = useState<Map<number, number>>(EMPTY_BUCKETS)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!clusterID) {
      setLoading(false)
      return
    }

    let cancelled = false

    async function fetchOnce() {
      try {
        if (!clusterID) return
        const before = new Date()
        const after = new Date(before.getTime() - minutes * 60_000)
        const records = await fetchCheckpointHistory({
          clusterID,
          status: "FAILED",
          after: after.toISOString(),
          before: before.toISOString(),
          maxRecords: 500,
        })
        if (cancelled) return

        const next = new Map<number, number>()
        for (const r of records) {
          const ts = r.triggerTimestamp ?? r.capturedAt
          const parsed = Date.parse(ts)
          if (Number.isNaN(parsed)) continue
          const bucket = Math.floor(parsed / 60_000) * 60_000
          next.set(bucket, (next.get(bucket) ?? 0) + 1)
        }
        setBuckets(next)
        setError(null)
        setLoading(false)
      } catch (e) {
        if (cancelled) return
        setError(
          e instanceof Error ? e.message : "Failed to fetch checkpoint history",
        )
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

  return { buckets, loading, error }
}
