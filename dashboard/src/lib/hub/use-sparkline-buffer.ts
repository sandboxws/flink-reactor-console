/**
 * useSparklineBuffer — accumulates a stream of scalar values into a
 * fixed-length ring buffer suitable for an inline sparkline.
 *
 * Each non-null value pushed into the buffer appends to the tail;
 * when capacity is reached the oldest value is dropped.
 */

import { useCallback, useRef, useState } from "react"

export function useSparklineBuffer(capacity = 30) {
  const bufRef = useRef<number[]>([])
  const [points, setPoints] = useState<number[]>([])

  const push = useCallback(
    (value: number | null) => {
      if (value === null || !Number.isFinite(value)) return
      const buf = bufRef.current
      buf.push(value)
      if (buf.length > capacity) buf.shift()
      setPoints([...buf])
    },
    [capacity],
  )

  const reset = useCallback(() => {
    bufRef.current = []
    setPoints([])
  }, [])

  return { points, push, reset }
}
