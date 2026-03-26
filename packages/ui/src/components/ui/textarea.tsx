/** Styled multiline text input with border focus ring. */
"use client"

import { cn } from "../../lib/cn"

/** Multiline text input with dashboard theme styling and focus-visible ring. */
function Textarea({
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "flex min-h-[80px] w-full rounded-md border border-dash-border bg-dash-surface px-3 py-2 text-sm text-zinc-200 transition-colors placeholder:text-zinc-500 focus-visible:border-fr-purple focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fr-purple/30 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  )
}

export { Textarea }
