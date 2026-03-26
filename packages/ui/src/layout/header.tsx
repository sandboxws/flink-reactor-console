/** Top navigation header bar with logo, breadcrumbs, and action slots. */
"use client"

import { ChevronLeft } from "lucide-react"
import { cn } from "../lib/cn"

/** Single breadcrumb segment with a routing key and display label. */
export interface Breadcrumb {
  key: string
  label: string
}

/** Props for the Header top-bar component. */
export interface HeaderProps {
  /** Content rendered at the far left (e.g. sidebar toggle) */
  leftContent?: React.ReactNode
  /** Root label shown before breadcrumbs */
  rootLabel?: string
  /** Breadcrumb items */
  breadcrumbs?: Breadcrumb[]
  /** Right-side content (status indicators, buttons, etc.) */
  rightContent?: React.ReactNode
  /** Custom link component for clickable breadcrumbs (React Router Link, Next.js Link, etc.) */
  LinkComponent?: React.ComponentType<{
    href: string
    className?: string
    children: React.ReactNode
  }>
  /** Back navigation callback. When provided, shows a back button. */
  onBack?: () => void
  className?: string
}

/** Header — top bar with breadcrumb navigation and right-side controls. */
export function Header({
  leftContent,
  rootLabel = "Dashboard",
  breadcrumbs = [],
  rightContent,
  LinkComponent,
  onBack,
  className,
}: HeaderProps) {
  const Link = LinkComponent as
    | React.ComponentType<{
        href: string
        className?: string
        children: React.ReactNode
      }>
    | undefined

  return (
    <header
      className={cn(
        "flex h-11 shrink-0 items-center justify-between border-b border-dash-border bg-dash-panel px-4",
        className,
      )}
    >
      {/* Left: optional content + back button + breadcrumbs */}
      <div className="flex items-center gap-1.5 text-xs">
        {leftContent}
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="mr-1 rounded-md p-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          >
            <ChevronLeft className="size-3.5" />
          </button>
        )}
        {Link ? (
          <Link
            href="/"
            className="text-zinc-500 transition-colors hover:text-zinc-300"
          >
            {rootLabel}
          </Link>
        ) : (
          <span className="text-zinc-500">{rootLabel}</span>
        )}
        {breadcrumbs.map((crumb, i) => {
          const isLast = i === breadcrumbs.length - 1
          return (
            <span key={crumb.key} className="flex items-center gap-1.5">
              <span className="text-zinc-600">/</span>
              {isLast || !Link ? (
                <span
                  className={cn(isLast ? "text-zinc-200" : "text-zinc-300")}
                >
                  {crumb.label}
                </span>
              ) : (
                <Link
                  href={crumb.key}
                  className="text-zinc-400 transition-colors hover:text-zinc-200"
                >
                  {crumb.label}
                </Link>
              )}
            </span>
          )
        })}
      </div>

      {/* Right: context-aware controls */}
      {rightContent && (
        <div className="flex items-center gap-3 text-xs">{rightContent}</div>
      )}
    </header>
  )
}

/** Generates breadcrumb segments from a URL pathname. */
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
