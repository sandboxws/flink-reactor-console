/**
 * @module sidebar
 * Collapsible navigation sidebar with grouped route links and a dynamic
 * instruments section. Collapse state is persisted via {@link useUiStore}.
 */

import { InstrumentSidebarSection } from "@flink-reactor/instruments-ui"
import { Link, useLocation } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Code,
  Database,
  FolderTree,
  Gauge,
  GitFork,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Play,
  ScrollText,
  Search,
  Server,
  Settings,
  Upload,
} from "lucide-react"
import { cn } from "@/lib/cn"
import { isLinkEnabled, isSectionEnabled } from "@/lib/dashboard-config"
import { useUiStore } from "@/stores/ui-store"

/** A single navigation link in the sidebar. */
type NavItem = {
  /** Route path passed to TanStack Router's {@link Link}. */
  href: string
  /** Display label shown next to the icon when sidebar is expanded. */
  label: string
  /** Lucide icon component rendered for this link. */
  icon: LucideIcon
}

/** A labeled group of related {@link NavItem} entries in the sidebar. */
type NavGroup = {
  /** Stable identifier used in dashboard.config.toml to disable this section. */
  id: string
  /** Section heading displayed above the group's links. */
  label: string
  /** Ordered list of navigation links within this group. */
  items: NavItem[]
}

/** Static navigation structure defining all sidebar groups and their routes. */
const NAV_GROUPS: NavGroup[] = [
  {
    id: "overview",
    label: "Overview",
    items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    id: "jobs",
    label: "Jobs",
    items: [
      { href: "/jobs/running", label: "Running Jobs", icon: Play },
      { href: "/jobs/completed", label: "Completed Jobs", icon: CheckCircle2 },
      { href: "/jobs/submit", label: "Submit New Job", icon: Upload },
      {
        href: "/deployments",
        label: "Blue-Green Deployments",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    id: "cluster",
    label: "Cluster",
    items: [
      { href: "/task-managers", label: "Task Managers", icon: Server },
      { href: "/job-manager", label: "Job Manager", icon: Settings },
      { href: "/insights/health", label: "Cluster Health", icon: HeartPulse },
    ],
  },
  {
    id: "observe",
    label: "Observe",
    items: [
      { href: "/insights/metrics", label: "Metrics Explorer", icon: LineChart },
      {
        href: "/insights/bottlenecks",
        label: "Bottleneck Analyzer",
        icon: GitFork,
      },
      { href: "/monitoring/alerts", label: "Alerts & Rules", icon: Bell },
      {
        href: "/monitoring/checkpoints",
        label: "Checkpoint Analytics",
        icon: BarChart3,
      },
      { href: "/logs", label: "Logs", icon: ScrollText },
      { href: "/errors", label: "Errors", icon: AlertTriangle },
    ],
  },
  {
    id: "data",
    label: "Data",
    items: [
      {
        href: "/materialized-tables",
        label: "Materialized Tables",
        icon: Database,
      },
      {
        href: "/catalogs/available",
        label: "Available Catalogs",
        icon: FolderTree,
      },
      {
        href: "/catalogs/explore",
        label: "Explore Catalogs",
        icon: Search,
      },
    ],
  },
  {
    id: "tools",
    label: "Tools",
    items: [
      {
        href: "/sandbox",
        label: "Synthesis Sandbox",
        icon: Code,
      },
      { href: "/admin/simulations", label: "Simulations", icon: Activity },
      { href: "/admin/benchmarks", label: "Benchmarks", icon: Gauge },
    ],
  },
]

/**
 * Collapsible navigation sidebar.
 *
 * Renders grouped route links from {@link NAV_GROUPS} plus a dynamic
 * {@link InstrumentSidebarSection} for instrument-contributed pages.
 * Active link is determined by prefix-matching the current pathname.
 * Collapse/expand state is read from and toggled via {@link useUiStore}.
 */
export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const pathname = useLocation({ select: (l) => l.pathname })

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-dash-border bg-dash-panel transition-[width] duration-200",
        collapsed ? "w-12" : "w-48",
      )}
    >
      {/* Logo */}
      <div className="flex h-11 items-center gap-2 border-b border-dash-border px-3">
        <img src="/favicon.svg" alt="FlinkReactor" className="size-5 shrink-0 rounded" />
        {!collapsed && (
          <div className="flex flex-col leading-none">
            <span className="text-xs font-semibold tracking-wide text-zinc-300">
              FlinkReactor
            </span>
            <span className="font-mono text-[9px] font-medium tracking-widest text-fr-coral/70 uppercase">
              Console
            </span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-1.5">
        {NAV_GROUPS.filter((g) => isSectionEnabled(g.id)).map((group) => {
          const items = group.items.filter((i) => isLinkEnabled(i.href))
          if (items.length === 0) return null
          return (
            <div key={group.id} className="mb-1">
              {!collapsed && (
                <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                  {group.label}
                </div>
              )}
              <div className="space-y-0.5">
                {items.map((item) => {
                  const active = pathname.startsWith(item.href)
                  return (
                    <Link
                      key={item.href}
                      to={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                        active
                          ? "bg-white/[0.08] text-white"
                          : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
                      )}
                    >
                      <item.icon className="size-3.5 shrink-0" />
                      {!collapsed && <span>{item.label}</span>}
                    </Link>
                  )
                })}
              </div>
            </div>
          )
        })}

        {/* Dynamic instruments group — rendered by the instruments UI package */}
        {isSectionEnabled("instruments") && (
          <InstrumentSidebarSection
            collapsed={collapsed}
            activePath={pathname}
            LinkComponent={Link}
          />
        )}
      </nav>

      {/* Collapse toggle */}
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 items-center justify-center border-t border-dash-border text-zinc-500 transition-colors hover:text-zinc-300"
      >
        {collapsed ? (
          <ChevronRight className="size-3.5" />
        ) : (
          <ChevronLeft className="size-3.5" />
        )}
      </button>
    </aside>
  )
}
