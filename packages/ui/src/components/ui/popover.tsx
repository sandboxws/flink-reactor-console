"use client"

import { Popover as PopoverPrimitive } from "radix-ui"

import { cn } from "../../lib/cn"

const Popover = PopoverPrimitive.Root

const PopoverTrigger = PopoverPrimitive.Trigger

function PopoverContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof PopoverPrimitive.Content>) {
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        data-slot="content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 rounded-md border border-dash-border bg-dash-elevated shadow-md shadow-black/50 outline-none",
          className,
        )}
        {...props}
      />
    </PopoverPrimitive.Portal>
  )
}

export { Popover, PopoverTrigger, PopoverContent }
