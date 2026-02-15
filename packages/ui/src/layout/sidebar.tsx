"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/cn";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export interface SidebarProps {
  /** Navigation groups to display */
  navGroups: NavGroup[];
  /** Whether the sidebar is collapsed */
  collapsed?: boolean;
  /** Toggle collapse callback */
  onToggle?: () => void;
  /** Current active path for highlighting */
  activePath?: string;
  /** Logo component or content */
  logo?: React.ReactNode;
  /** Brand name shown when not collapsed */
  brandName?: string;
  /** Custom link component (for Next.js Link, React Router, etc.) */
  LinkComponent?: React.ComponentType<{
    href: string;
    className?: string;
    children: React.ReactNode;
  }>;
  className?: string;
}

/**
 * Sidebar — collapsible navigation sidebar with grouped nav items.
 *
 * Pass a custom LinkComponent for your router (Next.js Link, React Router Link, etc.)
 */
export function Sidebar({
  navGroups,
  collapsed = false,
  onToggle,
  activePath = "",
  logo,
  brandName = "FlinkReactor",
  LinkComponent = "a" as unknown as SidebarProps["LinkComponent"],
  className,
}: SidebarProps) {
  const Link = LinkComponent as React.ComponentType<{
    href: string;
    className?: string;
    children: React.ReactNode;
  }>;

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-dash-border bg-dash-panel transition-[width] duration-200",
        collapsed ? "w-12" : "w-48",
        className,
      )}
    >
      {/* Logo */}
      <div className="flex h-11 items-center gap-2 border-b border-dash-border px-3">
        {logo ?? (
          <div className="size-5 shrink-0 rounded bg-gradient-to-br from-fr-coral to-fr-purple" />
        )}
        {!collapsed && (
          <span className="text-xs font-semibold tracking-wide text-zinc-300">
            {brandName}
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-1.5">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active =
                  item.href === "/" ? activePath === "/" : activePath.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
                    )}
                  >
                    <item.icon className="size-3.5 shrink-0" />
                    {!collapsed && <span>{item.label}</span>}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Collapse toggle */}
      {onToggle && (
        <button
          type="button"
          onClick={onToggle}
          className="flex h-9 items-center justify-center border-t border-dash-border text-zinc-500 transition-colors hover:text-zinc-300"
        >
          {collapsed ? (
            <ChevronRight className="size-3.5" />
          ) : (
            <ChevronLeft className="size-3.5" />
          )}
        </button>
      )}
    </aside>
  );
}
