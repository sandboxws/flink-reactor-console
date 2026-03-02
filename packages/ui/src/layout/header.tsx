"use client"

import { cn } from "../lib/cn"

export interface Breadcrumb {
  key: string
  label: string
}

export interface HeaderProps {
  /** Root label shown before breadcrumbs */
  rootLabel?: string
  /** Breadcrumb items */
  breadcrumbs?: Breadcrumb[]
  /** Right-side content (status indicators, buttons, etc.) */
  rightContent?: React.ReactNode
  className?: string
}

/**
 * Header — top bar with breadcrumb navigation and right-side controls.
 *
 * Utility function to generate breadcrumbs from pathname:
 * ```ts
 * function breadcrumbFromPath(pathname: string): Breadcrumb[] {
 *   const segments = pathname.split("/").filter(Boolean);
 *   let path = "";
 *   return segments.map((s) => {
 *     path += `/${s}`;
 *     const label = s.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
 *     return { key: path, label };
 *   });
 * }
 * ```
 */
export function Header({
  rootLabel = "Dashboard",
  breadcrumbs = [],
  rightContent,
  className,
}: HeaderProps) {
  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center justify-between border-b border-dash-border bg-dash-panel px-4",
        className,
      )}
    >
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-zinc-500">{rootLabel}</span>
        {breadcrumbs.map((crumb) => (
          <span key={crumb.key} className="flex items-center gap-1.5">
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-300">{crumb.label}</span>
          </span>
        ))}
      </div>

      {/* Right: context-aware controls */}
      {rightContent && (
        <div className="flex items-center gap-3 text-xs">{rightContent}</div>
      )}
    </header>
  )
}

/**
 * Utility to generate breadcrumbs from a pathname
 */
export function breadcrumbFromPath(pathname: string): Breadcrumb[] {
  const segments = pathname.split("/").filter(Boolean)
  let path = ""
  return segments.map((s) => {
    path += `/${s}`
    const label = s
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
    return { key: path, label }
  })
}
