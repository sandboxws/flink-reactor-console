"use client"

import { Group, Panel, Separator } from "react-resizable-panels"

import { cn } from "../../lib/cn"

function ResizablePanelGroup({
  className,
  ...props
}: React.ComponentProps<typeof Group>) {
  return <Group className={cn("h-full w-full", className)} {...props} />
}

const ResizablePanel = Panel

function ResizableHandle({
  className,
  ...props
}: React.ComponentProps<typeof Separator>) {
  return (
    <Separator
      className={cn(
        "relative w-px bg-dash-border transition-colors",
        "after:absolute after:inset-y-0 after:left-1/2 after:w-3 after:-translate-x-1/2",
        "hover:bg-fr-purple/60 active:bg-fr-purple/80",
        "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-fr-purple/50",
        className,
      )}
      {...props}
    />
  )
}

export { ResizablePanelGroup, ResizablePanel, ResizableHandle }
