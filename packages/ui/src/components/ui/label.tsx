/** Radix Label wrapper — accessible form label with disabled-peer styling. */
"use client"

import { Label as LabelPrimitive } from "radix-ui"

import { cn } from "../../lib/cn"

/** Accessible label element that dims when its associated input is disabled. */
function Label({
  className,
  ...props
}: React.ComponentProps<typeof LabelPrimitive.Root>) {
  return (
    <LabelPrimitive.Root
      className={cn(
        "text-sm font-medium leading-none text-zinc-300 peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
        className,
      )}
      {...props}
    />
  )
}

export { Label }
