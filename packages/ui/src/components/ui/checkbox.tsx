"use client"

import { Checkbox as CheckboxPrimitive } from "radix-ui"
import { Check } from "lucide-react"

import { cn } from "../../lib/cn"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      className={cn(
        "peer size-4 shrink-0 rounded-sm border border-dash-border bg-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-fr-purple focus-visible:ring-offset-2 focus-visible:ring-offset-dash-panel disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-fr-purple data-[state=checked]:bg-fr-purple data-[state=checked]:text-white",
        className,
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
        <Check className="size-3" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
