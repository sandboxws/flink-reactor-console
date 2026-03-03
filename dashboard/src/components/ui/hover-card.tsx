"use client"

import * as HoverCardPrimitive from "@radix-ui/react-hover-card"

import { cn } from "@/lib/cn"

const HoverCard = HoverCardPrimitive.Root

const HoverCardTrigger = HoverCardPrimitive.Trigger

function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-64 rounded-md border border-dash-border bg-dash-elevated p-4 text-zinc-200 shadow-md shadow-black/50 outline-none",
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

const HoverCardArrow = HoverCardPrimitive.Arrow

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow }
