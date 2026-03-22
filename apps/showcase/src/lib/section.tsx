import { cn, Separator } from "@flink-reactor/ui"
import { useEffect, useRef, useState } from "react"

/* ─── Section ────────────────────────────────────────────────────────────── */

export function Section({
  id,
  title,
  description,
  children,
}: {
  id: string
  title: string
  description?: string
  children: React.ReactNode
}) {
  return (
    <>
      <Separator />
      <section id={id} className="scroll-mt-4">
        <h2 className="text-lg font-medium text-fg mb-1">{title}</h2>
        {description && (
          <p className="text-sm text-fg-muted mb-4">{description}</p>
        )}
        {!description && <div className="mb-4" />}
        {children}
      </section>
    </>
  )
}

/* ─── ShowcasePage ────────────────────────────────────────────────────────── */

export type TocItem = { id: string; label: string }

/**
 * Two-column layout with a sticky secondary sidebar listing component
 * sections. Uses IntersectionObserver to highlight the active section.
 */
export function ShowcasePage({
  title,
  description,
  items,
  children,
}: {
  title: string
  description?: string
  items: TocItem[]
  children: React.ReactNode
}) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? "")
  const observerRef = useRef<IntersectionObserver | null>(null)

  useEffect(() => {
    // Find the scroll container — Shell renders <main class="overflow-auto">
    const main = document.querySelector("main")
    if (!main) return

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id)
          }
        }
      },
      {
        root: main,
        rootMargin: "-10% 0px -80% 0px",
        threshold: 0,
      },
    )

    for (const item of items) {
      const el = document.getElementById(item.id)
      if (el) observerRef.current.observe(el)
    }

    return () => observerRef.current?.disconnect()
  }, [items])

  const scrollTo = (id: string) => {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: "instant", block: "start" })
  }

  return (
    <div className="flex">
      {/* Secondary sidebar — sticky, self-start prevents flex stretch */}
      <aside className="hidden lg:block sticky top-0 w-48 shrink-0 h-[calc(100vh-2.75rem)] overflow-y-auto border-r border-dash-border p-3">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
          Components
        </p>
        <nav className="flex flex-col gap-0.5">
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              className={cn(
                "rounded-md px-2 py-1 text-left font-mono text-xs transition-colors",
                activeId === item.id
                  ? "bg-fr-purple/15 text-fr-purple"
                  : "text-fg-secondary hover:bg-white/5 hover:text-fg",
              )}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col gap-8 p-6">
        <div>
          <h1 className="text-2xl font-semibold text-fg">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-fg-muted">{description}</p>
          )}
        </div>
        {children}
      </div>
    </div>
  )
}

/* ─── Legacy export (kept for pages that haven't migrated) ───────────────── */

export function TableOfContents({
  items,
}: {
  items: { id: string; label: string }[]
}) {
  return (
    <nav className="flex flex-wrap gap-2 text-sm lg:hidden">
      {items.map((item) => (
        <a
          key={item.id}
          href={`#${item.id}`}
          className="rounded-md bg-white/5 px-2 py-1 font-mono text-xs text-fg-secondary hover:bg-white/10 hover:text-fg transition-colors"
        >
          {item.label}
        </a>
      ))}
    </nav>
  )
}
