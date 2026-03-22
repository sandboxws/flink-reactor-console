"use client"

import { cn } from "../../lib/cn"

interface InputGroupProps extends React.HTMLAttributes<HTMLDivElement> {}

function InputGroup({ className, ...props }: InputGroupProps) {
  return (
    <div
      className={cn(
        "flex items-center rounded-md border border-dash-border bg-dash-surface transition-colors focus-within:border-fr-purple [&>input]:border-0 [&>input]:bg-transparent [&>input]:focus:ring-0 [&>input]:focus:outline-none",
        className,
      )}
      {...props}
    />
  )
}

function InputGroupAddon({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center px-2.5 text-sm text-fg-muted",
        className,
      )}
      {...props}
    />
  )
}

export { InputGroup, InputGroupAddon }
export type { InputGroupProps }
