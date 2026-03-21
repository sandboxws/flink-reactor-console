import { breadcrumbFromPath, Header, Shell, Sidebar } from "@flink-reactor/ui"
import {
  createRootRoute,
  Link,
  Outlet,
  useLocation,
} from "@tanstack/react-router"
import {
  Blocks,
  Clapperboard,
  FileText,
  Layers,
  LayoutGrid,
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
