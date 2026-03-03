"use client"

import { useEffect } from "react"
import { cn } from "../lib/cn"

export interface ShellProps {
  children: React.ReactNode
  sidebar?: React.ReactNode
  header?: React.ReactNode
  commandPalette?: React.ReactNode
  /** Callback for Cmd+K / Ctrl+K keyboard shortcut */
  onCommandPalette?: () => void
  className?: string
}

/**
 * Shell — root layout container with optional sidebar, header, and command palette.
 *
 * For the FlinkReactor dashboard, this wraps the entire app with a flex layout
 * that supports collapsible sidebar and fixed header.
 */
export function Shell({
  children,
  sidebar,
  header,
  commandPalette,
  onCommandPalette,
  className,
}: ShellProps) {
  // cmd+k / ctrl+k keyboard listener
  useEffect(() => {
    if (!onCommandPalette) return

    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        onCommandPalette?.()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [onCommandPalette])

  return (
    <div
      className={cn(
        "flex h-screen w-screen flex-col overflow-hidden",
        className,
      )}
    >
      {header}
      <div className="flex flex-1 overflow-hidden">
        {sidebar}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
      {commandPalette}
    </div>
  )
}
