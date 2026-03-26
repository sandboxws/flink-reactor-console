/** Duration display cell with human-readable formatting (e.g. "2h 15m"). */
"use client"

import { useEffect, useState } from "react"

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  if (totalSec < 60) return `${totalSec}s`
  const min = Math.floor(totalSec / 60)
  const sec = totalSec % 60
  if (min < 60) return `${min}m ${sec}s`
  const hr = Math.floor(min / 60)
  return `${hr}h ${min % 60}m`
}

/** Displays elapsed duration in a monospace cell, auto-ticking every second while the job is running. */
export function DurationCell({
  startTime,
  endTime,
  isRunning,
}: {
  startTime: Date
  endTime: Date | null
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
