import { breadcrumbFromPath, Header, Shell, Sidebar } from "@flink-reactor/ui"
import {
  createRootRoute,
  ErrorComponent,
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
  AlertTriangle,
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

function RootErrorComponent({ error }: { error: Error }) {
  return (
    <div className="flex items-center justify-center min-h-screen bg-fr-bg p-6">
      <div className="glass-card flex flex-col items-center gap-5 max-w-lg p-8 text-center">
        <AlertTriangle className="size-8 text-log-error opacity-70" />
        <div>
          <h1 className="text-base font-medium text-fg">Something went wrong</h1>
          <p className="mt-1 text-xs text-fg-muted">An error occurred while rendering this page.</p>
        </div>
        <pre className="w-full rounded-md bg-black/30 p-3 text-left font-mono text-[11px] leading-relaxed text-log-error/80 overflow-auto">
          {error.message}
        </pre>
        <Link
          to="/"
          className="rounded-md border border-dash-border px-4 py-1.5 text-sm text-fg-secondary transition-colors hover:bg-white/5 hover:text-fg"
        >
          Back to Home
        </Link>
      </div>
    </div>
  )
}

export const Route = createRootRoute({
  component: RootLayout,
  errorComponent: RootErrorComponent,
})
