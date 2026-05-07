/** FlinkReactor Hub sidebar — 240px, sectioned nav with mono uppercase headings. */
"use client"

import type { LucideIcon } from "lucide-react"
import type { ComponentType } from "react"

import { cn } from "../lib/cn"

interface HubSidebarLinkProps {
  to: string
  className?: string
  children: React.ReactNode
}

/** Default link renderer — plain `<a>`. Pass a router-aware LinkComponent (e.g. TanStack Router's Link) via HubShell to get client-side routing. */
function DefaultLink({ to, className, children }: HubSidebarLinkProps) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  )
}

interface HubSidebarItem {
  /** Visible label in the nav row. */
  label: string
  /** Path the row links to. */
  href: string
  /** Optional Lucide icon. */
  icon?: LucideIcon
  /** Optional trailing badge (number of running jobs, instrument health glyph, etc.). */
  count?: React.ReactNode
  /** Color the count cell — defaults to muted; "coral", "sage", "amber", "rose" map to FR tones. */
  countTone?: "default" | "coral" | "sage" | "amber" | "rose"
}

interface HubSidebarSection {
  /** Section heading (rendered uppercase mono). */
  label: string
  items: HubSidebarItem[]
}

interface HubSidebarProps {
  sections: HubSidebarSection[]
  /** Current pathname; used to mark the matching item .active. */
  activePath?: string
  /** Custom Link component — receives `{ to, className, children }`. Pass a router-aware Link. */
  LinkComponent?: ComponentType<HubSidebarLinkProps>
  className?: string
}

const TONE_TO_COLOR: Record<
  NonNullable<HubSidebarItem["countTone"]>,
  string
> = {
  default: "",
  coral: "var(--color-fr-coral)",
  sage: "var(--color-fr-sage)",
  amber: "var(--color-fr-amber)",
  rose: "var(--color-fr-rose)",
}

/** Sidebar with FR section grouping. Use sections from console-v2 mockup as the canonical layout. */
function HubSidebar({
  sections,
  activePath,
  LinkComponent = DefaultLink,
  className,
}: HubSidebarProps) {
  return (
    <aside
      className={cn(
        "border-r border-dash-border bg-dash-surface/30 px-3 py-5",
        className,
      )}
    >
      <nav className="space-y-1">
        {sections.map((section, idx) => (
          <div key={section.label}>
            <h3
              className={cn(
                "section-heading mb-2 px-2.5",
                idx === 0 ? "mt-1" : "mt-5",
              )}
            >
              {section.label}
            </h3>
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive = activePath === item.href
              const tone = item.countTone ?? "default"
              return (
                <LinkComponent
                  key={item.href}
                  to={item.href}
                  className={cn("nav-item", isActive && "active")}
                >
                  {Icon ? <Icon className="shrink-0" /> : null}
                  <span>{item.label}</span>
                  {item.count !== undefined ? (
                    <span
                      className="nav-count"
                      style={
                        tone !== "default"
                          ? { color: TONE_TO_COLOR[tone] }
                          : undefined
                      }
                    >
                      {item.count}
                    </span>
                  ) : null}
                </LinkComponent>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )
}

export type {
  HubSidebarItem,
  HubSidebarLinkProps,
  HubSidebarProps,
  HubSidebarSection,
}
export { HubSidebar }
