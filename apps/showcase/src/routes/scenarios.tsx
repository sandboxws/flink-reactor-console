import { createFileRoute, Outlet } from "@tanstack/react-router"
import { SectionSidebar } from "@/lib/section-sidebar"

const SCENARIO_PAGES = [
  { label: "Healthy Cluster", path: "/scenarios/healthy" },
  { label: "Degraded Cluster", path: "/scenarios/degraded" },
  { label: "Failing Cluster", path: "/scenarios/failing" },
  { label: "Empty Cluster", path: "/scenarios/empty" },
]

/** Showcase layout: /scenarios -- Layout wrapper for state scenario demo pages with sidebar navigation. */
function ScenariosLayout() {
  return (
    <div className="flex">
      <SectionSidebar label="Scenarios" pages={SCENARIO_PAGES} />
      <div className="flex-1 min-w-0 lg:border-l lg:border-dash-border">
        <Outlet />
      </div>
    </div>
  )
}

export const Route = createFileRoute("/scenarios")({
  component: ScenariosLayout,
})
