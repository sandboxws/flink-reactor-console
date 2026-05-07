/** Hub command palette — rethemed cmdk dialog. Matches console-v2 aesthetic. */
"use client"

import { Command } from "cmdk"
import type { LucideIcon } from "lucide-react"
import { Search } from "lucide-react"
import { useEffect } from "react"
import { cn } from "../lib/cn"

export interface HubCommandRoute {
  label: string
  href: string
  /** Optional grouping label — items with the same group render under one header. */
  group?: string
  icon: LucideIcon
  /** Optional keyboard hint shown on the right (e.g., "G O" for go-to-overview). */
  hint?: string
  /** Optional secondary text (URL path, description). */
  sublabel?: string
}

export interface HubCommandPaletteProps {
  /** Whether the palette is open. */
  open: boolean
  /** Close callback. */
  onClose: () => void
  /** Navigation callback when a route is selected. */
  onNavigate: (href: string) => void
  /** Routes to display, optionally grouped via the `group` field. */
  routes: HubCommandRoute[]
  /** Placeholder text for the search input. */
  placeholder?: string
  className?: string
}

/** HubCommandPalette — Cmd+K palette themed for the Hub design language.
 *  Mono input, glass panel surface, fr-coral select highlight. Matches the
 *  look of the Hub top bar's search input but in modal form. */
export function HubCommandPalette({
  open,
  onClose,
  onNavigate,
  routes,
  placeholder = "Search Hub — pages, jobs, alerts, metrics…",
  className,
}: HubCommandPaletteProps) {
  /* Close on Escape (cmdk handles it for the input, but a global listener
     keeps it consistent with other modal patterns). */
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("keydown", onKey)
    }
  }, [open, onClose])

  if (!open) return null

  function handleSelect(href: string) {
    onNavigate(href)
    onClose()
  }

  /* Group routes for cmdk's <Command.Group>; items without group render
     ungrouped at top. */
  const grouped = new Map<string | undefined, HubCommandRoute[]>()
  for (const r of routes) {
    const arr = grouped.get(r.group) ?? []
    arr.push(r)
    grouped.set(r.group, arr)
  }
  const ungrouped = grouped.get(undefined) ?? []
  grouped.delete(undefined)

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[18vh]">
      <button
        type="button"
        aria-label="Close command palette"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
        tabIndex={-1}
      />

      <Command
        className={cn(
          "relative w-full max-w-xl overflow-hidden rounded-lg border border-dash-border bg-fr-bg/95 shadow-2xl backdrop-blur-md",
          className,
        )}
        loop
      >
        <div className="relative flex items-center border-b border-dash-border">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 size-4 text-fg-faint"
            aria-hidden="true"
          />
          <Command.Input
            placeholder={placeholder}
            className="form-input mono w-full border-0 bg-transparent pl-11 pr-4"
            style={{ height: 44, fontSize: 12 }}
            autoFocus
          />
          <kbd className="absolute right-3 top-1/2 -translate-y-1/2 rounded border border-dash-border bg-dash-surface px-1.5 py-0.5 font-mono text-[9px] text-fg-faint">
            esc
          </kbd>
        </div>

        <Command.List className="max-h-80 overflow-y-auto p-2">
          <Command.Empty className="px-4 py-6 text-center font-mono text-[11px] text-fg-faint">
            no matches
          </Command.Empty>

          {ungrouped.length > 0 ? (
            <Command.Group>
              {ungrouped.map((r) => (
                <CommandRow key={r.href} route={r} onSelect={handleSelect} />
              ))}
            </Command.Group>
          ) : null}

          {Array.from(grouped.entries()).map(([groupName, items]) => (
            <Command.Group
              key={groupName}
              heading={groupName}
              className="cmdk-hub-group"
            >
              {items.map((r) => (
                <CommandRow key={r.href} route={r} onSelect={handleSelect} />
              ))}
            </Command.Group>
          ))}
        </Command.List>

        <div className="flex items-center justify-between border-t border-dash-border bg-dash-surface/50 px-4 py-2 font-mono text-[10px] text-fg-faint">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="rounded border border-dash-border bg-dash-panel px-1 py-0.5">
                ↑↓
              </kbd>{" "}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-dash-border bg-dash-panel px-1 py-0.5">
                ↵
              </kbd>{" "}
              open
            </span>
          </div>
          <span>flinkreactor.hub</span>
        </div>
      </Command>
    </div>
  )
}

function CommandRow({
  route,
  onSelect,
}: {
  route: HubCommandRoute
  onSelect: (href: string) => void
}) {
  const Icon = route.icon
  return (
    <Command.Item
      value={`${route.label} ${route.sublabel ?? ""} ${route.href}`}
      onSelect={() => onSelect(route.href)}
      className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-[13px] text-fg-muted transition-colors data-[selected=true]:bg-fr-coral/10 data-[selected=true]:text-zinc-100"
    >
      <Icon
        className="size-4 text-fg-faint group-data-[selected=true]:text-fr-coral"
        aria-hidden="true"
      />
      <span className="flex-1 truncate">{route.label}</span>
      {route.sublabel ? (
        <span className="font-mono text-[10px] text-fg-faint">
          {route.sublabel}
        </span>
      ) : null}
      {route.hint ? (
        <kbd className="rounded border border-dash-border bg-dash-surface px-1.5 py-0.5 font-mono text-[9px] text-fg-faint">
          {route.hint}
        </kbd>
      ) : null}
    </Command.Item>
  )
}
