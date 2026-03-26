/** Radix Collapsible wrapper — show/hide content with a trigger. */
"use client"

import { Collapsible as CollapsiblePrimitive } from "radix-ui"

/** Root collapsible container. */
const Collapsible = CollapsiblePrimitive.Root

/** Element that toggles the collapsible open/closed. */
const CollapsibleTrigger = CollapsiblePrimitive.CollapsibleTrigger

/** Content region that shows/hides. */
const CollapsibleContent = CollapsiblePrimitive.CollapsibleContent

export { Collapsible, CollapsibleTrigger, CollapsibleContent }
