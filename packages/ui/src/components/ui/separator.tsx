/** Radix Separator wrapper — horizontal or vertical visual divider. */
"use client"

import { Separator as SeparatorPrimitive } from "radix-ui"

import { cn } from "../../lib/cn"

/** Thin line divider with horizontal/vertical orientation support. */
function Separator({
  className,
  orientation = "horizontal",
  decorative = true,
  ...props
}: React.ComponentProps<typeof SeparatorPrimitive.Root>) {
  return (
    <SeparatorPrimitive.Root
      decorative={decorative}
      orientation={orientation}
      className={cn(
        "shrink-0 bg-dash-border",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
      {...props}
    />
  )
}

export { Separator }
