/** Radix HoverCard wrapper — content card that appears on hover. */
"use client"

import { HoverCard as HoverCardPrimitive } from "radix-ui"

import { cn } from "../../lib/cn"

/** Root hover-card state container (Radix HoverCard.Root). */
const HoverCard = HoverCardPrimitive.Root

/** Element that triggers the hover card on mouse enter. */
const HoverCardTrigger = HoverCardPrimitive.Trigger

/** Floating card panel with entry/exit animations. */
function HoverCardContent({
  className,
  align = "center",
  sideOffset = 4,
  ...props
}: React.ComponentProps<typeof HoverCardPrimitive.Content>) {
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        data-slot="content"
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-50 w-64 rounded-md border border-dash-border bg-dash-elevated p-4 text-zinc-200 shadow-md shadow-black/50 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          className,
        )}
        {...props}
      />
    </HoverCardPrimitive.Portal>
  )
}

/** Arrow pointing from the card to the trigger. */
const HoverCardArrow = HoverCardPrimitive.Arrow

export { HoverCard, HoverCardTrigger, HoverCardContent, HoverCardArrow }
