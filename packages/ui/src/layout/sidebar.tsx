"use client";

import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight, PanelLeft } from "lucide-react";
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
  /** Where to render the collapse toggle: "bottom" (default) or "top" (next to window controls) */
  togglePosition?: "top" | "bottom";
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
  togglePosition = "bottom",
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

  const showTopToggle = onToggle && togglePosition === "top";
  const showBottomToggle = onToggle && togglePosition === "bottom";
  const showBrand = logo !== false || brandName;

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-dash-border bg-dash-panel transition-[width] duration-200",
        collapsed ? "w-12" : "w-48",
        className,
      )}
    >
      {/* Top area: brand and/or toggle */}
      {(showBrand || showTopToggle) && (
        <div
          className={cn(
            "flex items-center border-b border-dash-border px-3 h-11",
            showBrand && showTopToggle && "justify-between",
          )}
        >
          {showBrand && (
            <div className="flex items-center gap-2">
              {logo ?? (
                <div className="size-5 shrink-0 rounded bg-gradient-to-br from-fr-coral to-fr-purple" />
              )}
              {!collapsed && brandName && (
                <span className="text-xs font-semibold tracking-wide text-zinc-300">
                  {brandName}
                </span>
              )}
            </div>
          )}
          {showTopToggle && (
            <button
              type="button"
              onClick={onToggle}
              className="flex size-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
            >
              <PanelLeft className="size-3.5" />
            </button>
          )}
        </div>
      )}

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

      {/* Bottom collapse toggle */}
      {showBottomToggle && (
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
