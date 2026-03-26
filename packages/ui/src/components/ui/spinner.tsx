/** Animated loading spinner with size presets and accessible label. */
"use client"

import { Loader2 } from "lucide-react"

import { cn } from "../../lib/cn"

type SpinnerSize = "sm" | "default" | "lg"

interface SpinnerProps extends React.HTMLAttributes<HTMLSpanElement> {
  size?: SpinnerSize
  label?: string
}

const sizeStyles: Record<SpinnerSize, string> = {
  sm: "size-3",
  default: "size-4",
  lg: "size-6",
}

/** Rotating Loader2 icon with sm/default/lg sizes and an aria-label for screen readers. */
function Spinner({
  className,
  size = "default",
  label = "Loading",
  ...props
}: SpinnerProps) {
  return (
    <span role="status" aria-label={label} className={cn("inline-flex items-center justify-center", className)} {...props}>
      <Loader2 className={cn("animate-spin text-fg-muted", sizeStyles[size])} />
      <span className="sr-only">{label}</span>
    </span>
  )
}

export { Spinner }
export type { SpinnerProps, SpinnerSize }
