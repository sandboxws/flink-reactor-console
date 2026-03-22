import { formatDuration } from "@flink-reactor/ui"
import { useEffect, useState } from "react"

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
