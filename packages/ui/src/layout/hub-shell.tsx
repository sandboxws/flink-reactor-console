/** FlinkReactor Hub shell — composes top bar + sidebar + main + optional rail. */
"use client"

import type { ComponentType } from "react"

import { cn } from "../lib/cn"
import { HubSidebar, type HubSidebarSection } from "./hub-sidebar"
import { HubTopBar, type HubTopBarProps } from "./hub-top-bar"

interface HubShellLinkProps {
  to: string
  className?: string
  children: React.ReactNode
}

interface HubShellProps {
  /** Sidebar sections — pass the canonical Hub sections from `defaultHubSidebarSections()` or your own. */
  sidebarSections: HubSidebarSection[]
  /** Current pathname for sidebar active highlighting. */
  activePath?: string
  /** Top bar props — cluster, search, user. */
  topBar: Omit<HubTopBarProps, "LinkComponent">
  /** Optional right rail. When present, layout switches to with-rail (240/1fr/300). */
  rail?: React.ReactNode
  /** Router-aware Link component for sidebar items + brand. Defaults to plain anchor. */
  LinkComponent?: ComponentType<HubShellLinkProps>
  /** Apply .dot-grid texture to the page background. */
  dotGrid?: boolean
  className?: string
  children: React.ReactNode
}

/** Top-level Hub layout. Renders top bar, sidebar, main slot, and optional right rail.
 *  Matches console-v2 page-shell + page-grid markup exactly. */
function HubShell({
  sidebarSections,
  activePath,
  topBar,
  rail,
  LinkComponent,
  dotGrid = false,
  className,
  children,
}: HubShellProps) {
  return (
    <div className={cn("page-shell", dotGrid && "dot-grid", className)}>
      <HubTopBar {...topBar} LinkComponent={LinkComponent} />
      <div className={cn("page-grid", rail && "with-rail")}>
        <HubSidebar
          sections={sidebarSections}
          activePath={activePath}
          LinkComponent={LinkComponent}
        />
        <main className="px-8 py-6 min-w-0">{children}</main>
        {rail ? (
          <aside className="border-l border-dash-border bg-dash-surface/30 px-5 py-6">
            {rail}
          </aside>
        ) : null}
      </div>
    </div>
  )
}

export type { HubShellLinkProps, HubShellProps }
export { HubShell }
