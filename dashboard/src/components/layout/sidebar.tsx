import { Link, useLocation } from "@tanstack/react-router"
import type { LucideIcon } from "lucide-react"
import {
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Database,
  GitFork,
  HeartPulse,
  LayoutDashboard,
  LineChart,
  Play,
  ScrollText,
  Server,
  Settings,
  Upload,
} from "lucide-react"
import { getInstrumentIcon } from "@/components/instruments/instrument-icons"
import { cn } from "@/lib/cn"
import { useInstrumentStore } from "@/stores/instrument-store"
import { useUiStore } from "@/stores/ui-store"

type NavItem = {
  href: string
  label: string
  icon: LucideIcon
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Cluster",
    items: [{ href: "/overview", label: "Overview", icon: LayoutDashboard }],
  },
  {
    label: "Jobs",
    items: [
      { href: "/jobs/running", label: "Running Jobs", icon: Play },
      { href: "/jobs/completed", label: "Completed Jobs", icon: CheckCircle2 },
    ],
  },
  {
    label: "Deployments",
    items: [
      {
        href: "/deployments",
        label: "Blue-Green",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Data Management",
    items: [
      {
        href: "/materialized-tables",
        label: "Materialized Tables",
        icon: Database,
      },
    ],
  },
  {
    label: "Insights",
    items: [
      { href: "/insights/health", label: "Cluster Health", icon: HeartPulse },
      {
        href: "/insights/bottlenecks",
        label: "Bottleneck Analyzer",
        icon: GitFork,
      },
      { href: "/insights/metrics", label: "Metrics Explorer", icon: LineChart },
    ],
  },
  {
    label: "Cluster Management",
    items: [
      { href: "/task-managers", label: "Task Managers", icon: Server },
      { href: "/job-manager", label: "Job Manager", icon: Settings },
    ],
  },
  {
    label: "Monitoring",
    items: [
      { href: "/monitoring/alerts", label: "Alerts & Rules", icon: Bell },
      {
        href: "/monitoring/checkpoints",
        label: "Checkpoint Analytics",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Diagnostics",
    items: [
      { href: "/logs", label: "Logs", icon: ScrollText },
      { href: "/errors", label: "Errors", icon: AlertTriangle },
    ],
  },
  {
    label: "Operations",
    items: [{ href: "/jobs/submit", label: "Submit New Job", icon: Upload }],
  },
]

function InstrumentsSidebarSkeleton({ collapsed }: { collapsed: boolean }) {
  return (
    <div className="mb-1">
      {!collapsed && (
        <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          Instruments
        </div>
      )}
      <div className="space-y-0.5">
        {Array.from({ length: 2 }).map((_, i) => (
          <div
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder skeletons never reorder
            key={i}
            className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5"
          >
            <div className="size-3.5 shrink-0 animate-pulse rounded bg-zinc-700" />
            {!collapsed && (
              <div className="h-3 w-20 animate-pulse rounded bg-zinc-700" />
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export function Sidebar() {
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggle = useUiStore((s) => s.toggleSidebar)
  const pathname = useLocation({ select: (l) => l.pathname })
  const instruments = useInstrumentStore((s) => s.instruments)
  const instrumentsLoading = useInstrumentStore((s) => s.loading)

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-dash-border bg-dash-panel transition-[width] duration-200",
        collapsed ? "w-12" : "w-48",
      )}
    >
      {/* Logo */}
      <div className="flex h-11 items-center gap-2 border-b border-dash-border px-3">
        <div className="size-5 shrink-0 rounded bg-gradient-to-br from-fr-coral to-fr-purple" />
        {!collapsed && (
          <span className="text-xs font-semibold tracking-wide text-zinc-300">
            FlinkReactor
          </span>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-1.5">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                {group.label}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
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
        ))}

        {/* Dynamic instruments group */}
        {instrumentsLoading && instruments.length === 0 && (
          <InstrumentsSidebarSkeleton collapsed={collapsed} />
        )}
        {instruments.length > 0 && (
          <div className="mb-1">
            {!collapsed && (
              <div className="px-2.5 pb-1 pt-2.5 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
                Instruments
              </div>
            )}
            <div className="space-y-0.5">
              {instruments.map((inst) => {
                const Icon = getInstrumentIcon(inst.type)
                const href = `/instruments/${inst.name}`
                const active = pathname.startsWith(href)
                return (
                  <Link
                    key={inst.name}
                    to={href}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-xs transition-colors",
                      active
                        ? "bg-white/[0.08] text-white"
                        : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    {!collapsed && <span>{inst.displayName}</span>}
                  </Link>
                )
              })}
            </div>
          </div>
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
