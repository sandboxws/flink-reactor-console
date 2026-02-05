"use client";

import { Command } from "cmdk";
import type { LucideIcon } from "lucide-react";

export interface CommandRoute {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface CommandPaletteProps {
  /** Whether the palette is open */
  open: boolean;
  /** Close callback */
  onClose: () => void;
  /** Navigation callback when a route is selected */
  onNavigate: (href: string) => void;
  /** Routes to display */
  routes: CommandRoute[];
  /** Placeholder text for the search input */
  placeholder?: string;
}

/**
 * CommandPalette — Cmd+K style command palette for quick navigation.
 *
 * Usage:
 * ```tsx
 * <CommandPalette
 *   open={isOpen}
 *   onClose={() => setOpen(false)}
 *   onNavigate={(href) => { router.push(href); setOpen(false); }}
 *   routes={ROUTES}
 * />
 * ```
 */
export function CommandPalette({
  open,
  onClose,
  onNavigate,
  routes,
  placeholder = "Navigate to...",
}: CommandPaletteProps) {
  if (!open) return null;

  function handleSelect(href: string) {
    onNavigate(href);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        onKeyDown={(e) => e.key === "Escape" && onClose()}
        tabIndex={-1}
      />

      {/* Palette */}
      <Command className="relative w-full max-w-md rounded-lg border border-dash-border bg-dash-panel shadow-2xl">
        <Command.Input
          placeholder={placeholder}
          className="w-full border-b border-dash-border bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-zinc-500"
          autoFocus
        />
        <Command.List className="max-h-64 overflow-y-auto p-1.5">
          <Command.Empty className="px-4 py-3 text-xs text-zinc-500">
            No results found.
          </Command.Empty>
          {routes.map((route) => (
            <Command.Item
              key={route.href}
              value={route.label}
              onSelect={() => handleSelect(route.href)}
              className="flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-sm text-zinc-300 transition-colors data-[selected=true]:bg-white/[0.08] data-[selected=true]:text-white"
            >
              <route.icon className="size-4 text-zinc-500" />
              {route.label}
            </Command.Item>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}
