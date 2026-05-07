/**
 * PageFullBleed — escapes the `<main>` padding (`px-8 py-6`) inside
 * `<HubShell>` so an editor / canvas / kanban can fill the whole cell of
 * `.page-grid`.
 *
 * Usage:
 * ```tsx
 * <HubAppShell>
 *   <PageFullBleed>
 *     <YourFullBleedContent />
 *   </PageFullBleed>
 * </HubAppShell>
 * ```
 *
 * Sets a fixed height equal to the grid cell (`calc(100vh - 56px)` —
 * 56px is the top-bar height) so flex children can `flex-1` to claim
 * remaining space without bleeding past the viewport.
 */

import type { ReactNode } from "react"

interface PageFullBleedProps {
  children: ReactNode
  className?: string
}

export function PageFullBleed({ children, className }: PageFullBleedProps) {
  return (
    <div
      className={
        "-mx-8 -my-6 flex h-[calc(100vh-56px)] flex-col overflow-hidden" +
        (className ? ` ${className}` : "")
      }
    >
      {children}
    </div>
  )
}
