import { Outlet, createRootRoute, Link } from "@tanstack/react-router"
import { Shell, Sidebar, Header, breadcrumbFromPath } from "@flink-reactor/ui"
import { useLocation } from "@tanstack/react-router"
import {
  LayoutGrid,
  Layers,
  Blocks,
  FileText,
  Clapperboard,
} from "lucide-react"

const NAV_GROUPS = [
  {
    label: "Components",
    items: [
      { label: "Primitives", path: "/primitives", icon: LayoutGrid },
      { label: "Shared", path: "/shared", icon: Layers },
      { label: "Domain", path: "/domain", icon: Blocks },
    ],
  },
  {
    label: "Compositions",
    items: [
      { label: "Templates", path: "/templates", icon: FileText },
      { label: "Scenarios", path: "/scenarios", icon: Clapperboard },
    ],
  },
]

function RootLayout() {
  const location = useLocation()
  return (
    <Shell
      sidebar={
        <Sidebar
          navGroups={NAV_GROUPS}
          activePath={location.pathname}
          LinkComponent={Link}
          brandName="UI Showcase"
        />
      }
      header={
        <Header
          breadcrumbs={breadcrumbFromPath(location.pathname)}
          rootLabel="Showcase"
        />
      }
    >
      <Outlet />
    </Shell>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
})
