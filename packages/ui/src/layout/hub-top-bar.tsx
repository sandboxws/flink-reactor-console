/** FlinkReactor Hub top bar — brand + cluster selector + search + actions. */
"use client"

import { Bell, Search, Sparkles } from "lucide-react"
import type { ComponentType } from "react"
import { BrandGlyph } from "../components/ui/brand-glyph"
import {
  type ClusterEnv,
  ClusterSelector,
} from "../components/ui/cluster-selector"
import { cn } from "../lib/cn"

interface HubTopBarLinkProps {
  to: string
  className?: string
  children: React.ReactNode
}

function DefaultLink({ to, className, children }: HubTopBarLinkProps) {
  return (
    <a href={to} className={className}>
      {children}
    </a>
  )
}

interface HubTopBarProps {
  /** Active cluster info for the default selector pill. Ignored when `clusterSlot` is provided. */
  cluster?: { name: string; env: ClusterEnv }
  /** Click handler for the default cluster selector. Ignored when `clusterSlot` is provided. */
  onClusterClick?: () => void
  /** Custom cluster slot — replaces the default `<ClusterSelector>` pill. Use this to wrap the pill in a Popover/Dropdown. */
  clusterSlot?: React.ReactNode
  /** Search input placeholder. */
  searchPlaceholder?: string
  /** Fires when the user clicks the search input or focuses it via `/`. The
   *  input itself does NOT accept text — search happens in the consumer's
   *  command palette. */
  onSearchOpen?: () => void
  /** Avatar text — typically a single uppercase letter. */
  userInitial?: string
  /** Notification dot visibility. */
  hasNotifications?: boolean
  /** Theme toggle handler. */
  onThemeToggle?: () => void
  /** Notifications bell handler. */
  onNotificationsClick?: () => void
  /** Brand link target — defaults to "/hub". */
  brandHref?: string
  /** Custom Link component for brand link. */
  LinkComponent?: ComponentType<HubTopBarLinkProps>
  className?: string
}

/** Sticky top bar with brand, cluster, search, and right-side actions.
 *  Matches console-v2 markup exactly (brand-glyph + flinkreactor.hub wordmark + ALPHA chip). */
function HubTopBar({
  cluster,
  onClusterClick,
  clusterSlot,
  searchPlaceholder = "Type / to search pipelines, alerts, metrics...",
  onSearchOpen,
  userInitial = "A",
  hasNotifications = true,
  onThemeToggle,
  onNotificationsClick,
  brandHref = "/hub",
  LinkComponent = DefaultLink,
  className,
}: HubTopBarProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-40 flex h-14 items-center gap-5 border-b border-dash-border bg-fr-bg/95 px-6 backdrop-blur-md",
        className,
      )}
    >
      <LinkComponent to={brandHref} className="flex items-center gap-2.5">
        <BrandGlyph size={22} />
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-semibold tracking-tight text-zinc-100">
            flinkreactor<span className="text-fg-dim">.hub</span>
          </span>
          <span className="rounded border border-fr-coral/40 px-1.5 py-px font-mono text-[9px] font-semibold uppercase tracking-widest text-fr-coral">
            Alpha
          </span>
        </div>
      </LinkComponent>

      {clusterSlot ??
        (cluster ? (
          <ClusterSelector
            env={cluster.env}
            cluster={cluster.name}
            onClick={onClusterClick}
          />
        ) : null)}

      <button
        type="button"
        className="form-input mono relative max-w-md flex-1 cursor-pointer pl-9 text-left"
        style={{ height: 32, fontSize: 12 }}
        onClick={onSearchOpen}
        aria-label="Open command palette"
      >
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-faint size-4"
          aria-hidden="true"
        />
        <span className="text-fg-faint">{searchPlaceholder}</span>
        <kbd className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-dash-border bg-dash-surface px-1.5 py-0.5 font-mono text-[9px] text-fg-faint">
          /
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-3">
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          title="Theme"
          onClick={onThemeToggle}
          aria-label="Toggle theme"
        >
          <Sparkles className="text-fg-muted size-4" />
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm btn-icon"
          title="Notifications"
          onClick={onNotificationsClick}
          aria-label="Notifications"
        >
          <span className="relative inline-flex">
            <Bell className="text-fg-muted size-4" />
            {hasNotifications ? (
              <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-fr-coral" />
            ) : null}
          </span>
        </button>
        <button
          type="button"
          className="avatar avatar-coral h-8 w-8 text-[11px]"
          aria-label="User menu"
        >
          {userInitial}
        </button>
      </div>
    </header>
  )
}

export type { HubTopBarLinkProps, HubTopBarProps }
export { HubTopBar }
