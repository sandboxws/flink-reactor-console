/** Keyboard shortcut display — renders key combinations as styled key caps. */
"use client"

import { cn } from "../../lib/cn"

interface KbdProps extends React.HTMLAttributes<HTMLElement> {}

/** Single keyboard key rendered as a bordered inline badge. */
function Kbd({ className, children, ...props }: KbdProps) {
  return (
    <kbd
      className={cn(
        "inline-flex h-5 min-w-5 items-center justify-center rounded border border-dash-border bg-dash-elevated px-1.5 font-mono text-[10px] font-medium text-fg-dim",
        className,
      )}
      {...props}
    >
      {children}
    </kbd>
  )
}

interface KbdGroupProps extends React.HTMLAttributes<HTMLSpanElement> {}

/** Horizontal group of Kbd elements with tight spacing. */
function KbdGroup({ className, children, ...props }: KbdGroupProps) {
  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      {...props}
    >
      {children}
    </span>
  )
}

export { Kbd, KbdGroup }
export type { KbdProps, KbdGroupProps }
