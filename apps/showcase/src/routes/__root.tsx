import { Outlet, createRootRoute, Link, useLocation } from "@tanstack/react-router"
import { Shell, Sidebar, Header, breadcrumbFromPath } from "@flink-reactor/ui"
import {
  LayoutGrid,
  Layers,
  Blocks,
  FileText,
  Clapperboard,
} from "lucide-react"

/** Adapter: Sidebar passes href, but TanStack Router Link uses `to` */
function NavLink({
  href,
  className,
  children,
}: {
  href: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link to={href} className={className}>
      {children}
    </Link>
  )
}

const NAV_GROUPS = [
  {
    label: "Components",
    items: [
      { label: "Primitives", href: "/primitives", icon: LayoutGrid },
      { label: "Shared", href: "/shared", icon: Layers },
      { label: "Domain", href: "/domain", icon: Blocks },
    ],
  },
  {
    label: "Compositions",
    items: [
      { label: "Templates", href: "/templates", icon: FileText },
      { label: "Scenarios", href: "/scenarios", icon: Clapperboard },
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
          LinkComponent={NavLink}
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
