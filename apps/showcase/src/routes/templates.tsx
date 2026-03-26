import { createFileRoute, Outlet } from "@tanstack/react-router"
import { SectionSidebar } from "@/lib/section-sidebar"

const TEMPLATE_PAGES = [
  { label: "Overview", path: "/templates/overview" },
  { label: "Jobs", path: "/templates/jobs" },
  { label: "Logs", path: "/templates/logs" },
  { label: "Errors", path: "/templates/errors" },
  { label: "Monitoring", path: "/templates/monitoring" },
  { label: "Insights", path: "/templates/insights" },
  { label: "Task Managers", path: "/templates/task-managers" },
  { label: "Job Manager", path: "/templates/job-manager" },
  { label: "Deployments", path: "/templates/deployments" },
  { label: "Plan Analyzer", path: "/templates/plan-analyzer" },
  { label: "Catalogs", path: "/templates/catalogs" },
  { label: "Materialized Tables", path: "/templates/materialized-tables" },
]

/** Showcase layout: /templates -- Layout wrapper for template demo pages with sidebar navigation. */
function TemplatesLayout() {
  return (
    <div className="flex">
      <SectionSidebar label="Templates" pages={TEMPLATE_PAGES} />
      <div className="flex-1 min-w-0 lg:border-l lg:border-dash-border">
        <Outlet />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/templates")({
  component: TemplatesLayout,
})
