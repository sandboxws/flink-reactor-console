"use client"

import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "../../lib/cn"

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-white/10",
        className,
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 rounded-full bg-fr-purple transition-all"
        style={{ transform: `translateX(-${100 - (value ?? 0)}%)` }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
