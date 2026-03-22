import { cn } from "@flink-reactor/ui"
import { Link, useLocation } from "@tanstack/react-router"

export interface SectionPage {
  label: string
  path: string
}

/**
 * Secondary sidebar for navigating between sub-pages within a section.
 * Rendered by layout routes for Domain, Templates, and Scenarios.
 */
export function SectionSidebar({
  label,
  pages,
}: {
  label: string
  pages: SectionPage[]
}) {
  const location = useLocation()

  return (
    <aside className="hidden lg:block sticky top-0 w-48 shrink-0 h-[calc(100vh-2.75rem)] overflow-y-auto p-3">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-fg-muted">
        {label}
      </p>
      <nav className="flex flex-col gap-0.5">
        {pages.map((page) => (
          <Link
            key={page.path}
            to={page.path}
            className={cn(
              "rounded-md px-2 py-1 text-left font-mono text-xs transition-colors",
              location.pathname === page.path
                ? "bg-fr-purple/15 text-fr-purple"
                : "text-fg-secondary hover:bg-white/5 hover:text-fg",
            )}
          >
            {page.label}
          </Link>
        ))}
      </nav>
    </aside>
  )
}
