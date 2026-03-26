/** Loading skeleton placeholder with preset shape variants. */
"use client"

import { cn } from "../../lib/cn"

type SkeletonVariant = "default" | "text" | "heading" | "avatar" | "card"

const variantStyles: Record<SkeletonVariant, string> = {
  default: "",
  text: "h-4 w-full rounded",
  heading: "h-6 w-48 rounded",
  avatar: "size-8 rounded-full",
  card: "h-32 w-full rounded-lg",
}

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: SkeletonVariant
}

/** Pulsing placeholder with text/heading/avatar/card shape presets. */
function Skeleton({
  className,
  variant = "default",
  ...props
}: SkeletonProps) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-white/5",
        variantStyles[variant],
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }
export type { SkeletonVariant }
