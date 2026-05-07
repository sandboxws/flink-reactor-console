/** Filter / property chip with optional icon and count, toggleable via `active`. */
"use client"

import type { LucideIcon } from "lucide-react"

import { cn } from "../../lib/cn"

interface PropChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  count?: number
  icon?: LucideIcon
}

/** Small button-shaped chip used in filter rails on alerts, logs, jobs. */
function PropChip({
  active,
  count,
  icon: Icon,
  className,
  children,
  type = "button",
  ...props
}: PropChipProps) {
  return (
    <button
      type={type}
      className={cn("prop-chip", active && "active", className)}
      aria-pressed={active}
      {...props}
    >
      {Icon ? <Icon className="size-3" /> : null}
      <span>{children}</span>
      {count !== undefined ? <span className="count">{count}</span> : null}
    </button>
  )
}

export type { PropChipProps }
export { PropChip }
