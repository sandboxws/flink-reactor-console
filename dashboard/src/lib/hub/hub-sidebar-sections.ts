/** Canonical Hub sidebar — single source of truth across all Hub routes.
 *  Mirrors console-v2/overview.html exactly: 8 sections, specific icons,
 *  instrument health glyphs (✓/⚠).
 *
 *  Badge counts are injected at runtime by HubAppShell from Zustand stores. */

import type { HubSidebarSection } from "@flink-reactor/ui"
import {
  Activity,
  AlertTriangle,
  ArrowLeftRight,
  BarChart3,
  BellRing,
  CheckCircle2,
  Code2,
  Cpu,
  Database,
  FolderTree,
  GitFork,
  HeartPulse,
  Layers,
  LayoutDashboard,
  LineChart,
  Play,
  Plus,
  ScrollText,
  SearchCode,
  Server,
  Upload,
} from "lucide-react"

export const HUB_SIDEBAR_SECTIONS: HubSidebarSection[] = [
  {
    label: "Overview",
    items: [{ label: "Overview", href: "/hub", icon: LayoutDashboard }],
  },
  {
    label: "Jobs",
    items: [
      { label: "Running", href: "/hub/jobs/running", icon: Play },
      { label: "Completed", href: "/hub/jobs/completed", icon: CheckCircle2 },
      { label: "Submit", href: "/hub/jobs/submit", icon: Upload },
      {
        label: "Deployments",
        href: "/hub/deployments",
        icon: ArrowLeftRight,
      },
    ],
  },
  {
    label: "Cluster",
    items: [
      {
        label: "Task managers",
        href: "/hub/task-managers",
        icon: Server,
      },
      { label: "Job manager", href: "/hub/job-manager", icon: Cpu },
    ],
  },
  {
    label: "Observe",
    items: [
      { label: "Health", href: "/hub/insights/health", icon: HeartPulse },
      { label: "Metrics", href: "/hub/insights/metrics", icon: LineChart },
      {
        label: "Bottlenecks",
        href: "/hub/insights/bottlenecks",
        icon: GitFork,
      },
      {
        label: "Alerts",
        href: "/hub/monitoring/alerts",
        icon: BellRing,
      },
      {
        label: "Checkpoints",
        href: "/hub/monitoring/checkpoints",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Logs",
    items: [
      { label: "Logs", href: "/hub/logs", icon: ScrollText },
      { label: "Errors", href: "/hub/errors", icon: AlertTriangle },
    ],
  },
  {
    label: "Data",
    items: [
      {
        label: "Materialized",
        href: "/hub/materialized-tables",
        icon: Database,
      },
      { label: "Catalogs", href: "/hub/catalogs", icon: FolderTree },
      { label: "SQL explorer", href: "/hub/sql-explorer", icon: SearchCode },
    ],
  },
  {
    label: "Tools",
    items: [
      { label: "Sandbox", href: "/hub/sandbox/editor", icon: Code2 },
      {
        label: "Simulations",
        href: "/hub/admin/simulations",
        icon: Activity,
      },
      {
        label: "Benchmarks",
        href: "/hub/admin/benchmarks",
        icon: BarChart3,
      },
    ],
  },
  {
    label: "Instruments",
    items: [
      { label: "All instruments", href: "/hub/instruments", icon: Layers },
      { label: "Add instrument", href: "/hub/instruments", icon: Plus },
    ],
  },
]
