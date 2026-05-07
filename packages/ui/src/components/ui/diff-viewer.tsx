/** LCS-based unified diff viewer for two text blobs. Renders <DiffLine> rows. */
"use client"

import { useMemo } from "react"

import { cn } from "../../lib/cn"
import { DiffLine, type DiffVariant } from "./diff-line"

interface DiffViewerProps extends React.HTMLAttributes<HTMLDivElement> {
  /** "Before" text (older version). */
  a: string
  /** "After" text (newer version). */
  b: string
}

interface DiffRow {
  variant: DiffVariant
  oldLineNo?: number
  newLineNo?: number
  text: string
}

/** Compute a basic line-level LCS diff. */
function computeDiff(a: string, b: string): DiffRow[] {
  const A = a.split("\n")
  const B = b.split("\n")
  const m = A.length
  const n = B.length
  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  )
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      if (A[i] === B[j]) dp[i][j] = dp[i + 1][j + 1] + 1
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const rows: DiffRow[] = []
  let i = 0
  let j = 0
  let oldNo = 1
  let newNo = 1
  while (i < m && j < n) {
    if (A[i] === B[j]) {
      rows.push({
        variant: "context",
        oldLineNo: oldNo++,
        newLineNo: newNo++,
        text: A[i],
      })
      i++
      j++
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      rows.push({ variant: "removed", oldLineNo: oldNo++, text: A[i] })
      i++
    } else {
      rows.push({ variant: "added", newLineNo: newNo++, text: B[j] })
      j++
    }
  }
  while (i < m) {
    rows.push({ variant: "removed", oldLineNo: oldNo++, text: A[i] })
    i++
  }
  while (j < n) {
    rows.push({ variant: "added", newLineNo: newNo++, text: B[j] })
    j++
  }
  return rows
}

/** Side-by-side disabled — this is a unified diff. */
function DiffViewer({ a, b, className, ...props }: DiffViewerProps) {
  const rows = useMemo(() => computeDiff(a, b), [a, b])
  return (
    <div
      className={cn(
        "rounded-md border border-dash-border overflow-hidden",
        className,
      )}
      {...props}
    >
      {rows.map((row, idx) => (
        <DiffLine
          key={idx}
          variant={row.variant}
          oldLineNo={row.oldLineNo}
          newLineNo={row.newLineNo}
        >
          {row.text}
        </DiffLine>
      ))}
    </div>
  )
}

export type { DiffViewerProps }
export { DiffViewer }
