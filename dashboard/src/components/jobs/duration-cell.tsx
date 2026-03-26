/**
 * @module duration-cell
 *
 * Live-updating duration display for job table rows. For running jobs,
 * a 1-second interval tick keeps the elapsed time current. Completed
 * jobs show a static duration computed from start/end timestamps.
 */
import { formatDuration } from "@flink-reactor/ui"
import { useEffect, useState } from "react"

/**
 * Human-readable duration cell for job table rows.
 *
 * For running jobs, sets up a 1-second interval to keep the displayed
 * elapsed time live. The interval is cleaned up when the job completes
 * or the component unmounts. Uses {@link formatDuration} for display.
 */
export function DurationCell({
  startTime,
  endTime,
  isRunning,
}: {
  /** Job start timestamp. */
  startTime: Date
  /** Job end timestamp, or null if still running. */
  endTime: Date | null
  /** Whether to tick the display every second. */
  isRunning: boolean
}) {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const duration = isRunning
    ? now - startTime.getTime()
    : endTime
      ? endTime.getTime() - startTime.getTime()
      : 0

  return (
    <span className="font-mono text-xs text-zinc-400">
      {formatDuration(duration)}
    </span>
  )
}
