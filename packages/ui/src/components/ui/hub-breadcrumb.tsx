/** Hub breadcrumb — page-header text trail. Mirrors console-v2 markup. */
"use client"

import type { ComponentType } from "react"
import { cn } from "../../lib/cn"

interface HubBreadcrumbLinkProps {
  to: string
  className?: string
  children: React.ReactNode
}

function DefaultLink({ to, className, children }: HubBreadcrumbLinkProps) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  )
}

export interface HubBreadcrumbCrumb {
  /** Visible text. Pass an ID and set `mono` for IDs that benefit from monospace. */
  label: string
  /** Target href. Omit for the leaf (current page) crumb — renders as plain text. */
  to?: string
  /** Render the label in monospace (use for IDs, hashes, mono identifiers). */
  mono?: boolean
}

export interface HubBreadcrumbProps {
  crumbs: HubBreadcrumbCrumb[]
  /** Router-aware link for navigable crumbs. Defaults to plain anchor. */
  LinkComponent?: ComponentType<HubBreadcrumbLinkProps>
  className?: string
}

/** Compact text breadcrumb — used inside Hub page headers (above the title row).
 *  Separator is a low-contrast slash. Leaf crumbs render as plain (non-link) text. */
export function HubBreadcrumb({
  crumbs,
  LinkComponent = DefaultLink,
  className,
}: HubBreadcrumbProps) {
  if (crumbs.length === 0) return null
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn("text-[12px] text-fg-muted", className)}
    >
      {crumbs.map((c, i) => {
        const isLast = i === crumbs.length - 1
        const labelClass = c.mono ? "font-mono" : undefined
        return (
          <span key={`${c.label}-${i}`}>
            {c.to && !isLast ? (
              <LinkComponent
                to={c.to}
                className={cn("hover:text-fr-coral", labelClass)}
              >
                {c.label}
              </LinkComponent>
            ) : (
              <span className={cn(isLast ? "text-fg" : undefined, labelClass)}>
                {c.label}
              </span>
            )}
            {!isLast ? (
              <span className="text-fg-faint mx-1" aria-hidden="true">
                /
              </span>
            ) : null}
          </span>
        )
      })}
    </nav>
  )
}
