"use client"

import { cn } from "../../lib/cn"

function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-dash-border bg-dash-surface px-3 py-2 text-sm text-zinc-200 transition-colors placeholder:text-zinc-500 focus-visible:border-fr-purple focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
