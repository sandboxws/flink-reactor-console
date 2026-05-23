/**
 * useEngineBarsLive — engine-bars window with sub-second incremental updates.
 *
 * Wraps `useEngineBarsData` for the initial backfilled 38-minute window and
 * layers `useMetricStream(throughput)` on top. On each subscription event:
 *  - if the event lands in the current minute bucket, the rightmost bar's
 *    height grows to the peak observed in that minute (max);
 *  - if the event crosses into a new minute, the oldest bar is dropped and
 *    a fresh bucket is appended.
 *
 * When the subscription is unavailable (no clusterID, connection drop), the
 * hook degrades to the bars from `useEngineBarsData` — operator sees the 5s
 * polled view without any error UI.
 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  useEngineBarsData,
  type EngineBar,
} from "@/lib/hub/use-engine-bars-data"
import { useMetricStream } from "@/lib/hub/use-metric-stream"

const WINDOW_BUCKETS = 38
const BAR_MAX_HEIGHT_PX = 180

export type EngineBarsLiveResult = {
  bars: EngineBar[]
  loading: boolean
  empty: boolean
  error: string | null
  /** True when the subscription is the source of recent updates (vs. polling-only). */
  live: boolean
}

export function useEngineBarsLive(
  clusterID: string | null | undefined,
): EngineBarsLiveResult {
  const polled = useEngineBarsData(clusterID, { minutes: WINDOW_BUCKETS })
  const stream = useMetricStream(clusterID, "throughput")

  // Mutable rolling window seeded from `polled`. Stream events mutate this
  // copy, not the polled array (which is owned by useEngineBarsData).
  const [bars, setBars] = useState<EngineBar[]>([])
  const peakRef = useRef(0)

  // Re-seed when the polled backfill changes (initial load, refresh).
  useEffect(() => {
    if (polled.bars.length === 0) return
    setBars(polled.bars)
    peakRef.current = polled.bars.reduce((max, b) => Math.max(max, b.value), 0)
  }, [polled.bars])

  // Apply each subscription event to the rolling window.
  useEffect(() => {
    if (stream.value === null || stream.timestamp === null) return
    if (bars.length === 0) return

    const eventMs = Date.parse(stream.timestamp)
    if (Number.isNaN(eventMs)) return

    setBars((prev) => {
      if (prev.length === 0) return prev

      const lastBucketStart = prev[prev.length - 1].bucketStart.getTime()
      const minuteOffset = Math.floor((eventMs - lastBucketStart) / 60_000)

      const newPeak = Math.max(peakRef.current, stream.value ?? 0)
      peakRef.current = newPeak

      if (minuteOffset <= 0) {
        // Same minute: update the latest bucket's value (peak).
        const next = prev.slice()
        const last = next[next.length - 1]
        const peakValue = Math.max(last.value, stream.value ?? 0)
        next[next.length - 1] = {
          ...last,
          value: peakValue,
          height: heightFor(peakValue, newPeak),
        }
        // Rescale all bars against the new peak so visual proportions hold.
        return next.map((b) => ({
          ...b,
          height: heightFor(b.value, newPeak),
        }))
      }

      // Crossed one or more minute boundaries: shift left, append fresh buckets.
      const shifted = prev.slice(minuteOffset)
      const startMs = lastBucketStart + 60_000
      for (let i = 0; i < minuteOffset; i++) {
        const bucketStart = new Date(startMs + i * 60_000)
        const isCurrent = i === minuteOffset - 1
        const value = isCurrent ? (stream.value ?? 0) : 0
        shifted.push({
          bucketStart,
          value,
          height: heightFor(value, newPeak),
          failed: false,
        })
      }
      return shifted.map((b) => ({
        ...b,
        height: heightFor(b.value, newPeak),
      }))
    })
  }, [stream.value, stream.timestamp, bars.length])

  const live = !stream.error && !stream.loading && stream.value !== null

  return useMemo(
    () => ({
      bars: bars.length > 0 ? bars : polled.bars,
      loading: polled.loading,
      empty: polled.empty && !live,
      error: polled.error,
      live,
    }),
    [bars, polled.bars, polled.loading, polled.empty, polled.error, live],
  )
}

function heightFor(value: number, peak: number): number {
  if (peak <= 0) return 0
  return Math.round((value / peak) * BAR_MAX_HEIGHT_PX)
}
