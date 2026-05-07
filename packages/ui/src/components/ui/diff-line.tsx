/** Single diff row: 4-column grid (old# / new# / gutter / code) with background-tint variants. */
"use client"

import { cn } from "../../lib/cn"

type DiffVariant = "added" | "removed" | "context" | "hunk"

interface DiffLineProps extends React.HTMLAttributes<HTMLDivElement> {
  variant: DiffVariant
  oldLineNo?: number | string
  newLineNo?: number | string
}

const gutterChar: Record<DiffVariant, string> = {
  added: "+",
  removed: "-",
  context: "",
  hunk: "@@",
}

/** Background-tint diff row — added is sage, removed is coral, hunk is teal. No left border. */
function DiffLine({
  variant,
  oldLineNo,
  newLineNo,
  className,
  children,
  ...props
}: DiffLineProps) {
  return (
    <div className={cn("diff-line", variant, className)} {...props}>
      <span className="ln">{oldLineNo ?? ""}</span>
      <span className="ln">{newLineNo ?? ""}</span>
      <span className="gutter">{gutterChar[variant]}</span>
      <span className="code">{children}</span>
    </div>
  )
}

export type { DiffLineProps, DiffVariant }
export { DiffLine }
