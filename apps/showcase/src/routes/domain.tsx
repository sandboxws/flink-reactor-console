import { createFileRoute, Outlet } from "@tanstack/react-router"
import { SectionSidebar } from "@/lib/section-sidebar"

const DOMAIN_PAGES = [
  { label: "Overview", path: "/domain/overview" },
  { label: "Jobs", path: "/domain/jobs" },
  { label: "Logs", path: "/domain/logs" },
  { label: "Errors", path: "/domain/errors" },
  { label: "Monitoring", path: "/domain/monitoring" },
  { label: "Insights", path: "/domain/insights" },
  { label: "Plan Analyzer", path: "/domain/plan-analyzer" },
  { label: "Catalogs", path: "/domain/catalogs" },
  { label: "Tap", path: "/domain/tap" },
  { label: "Materialized Tables", path: "/domain/materialized-tables" },
]

/** Showcase layout: /domain -- Layout wrapper for domain component showcase pages with sidebar navigation. */
function DomainLayout() {
  return (
    <div className="flex">
      <SectionSidebar label="Domain" pages={DOMAIN_PAGES} />
      <div className="flex-1 min-w-0 lg:border-l lg:border-dash-border">
        <Outlet />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/domain")({
  component: DomainLayout,
})
