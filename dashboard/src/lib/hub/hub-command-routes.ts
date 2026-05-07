/** Routes available in the Hub command palette. Derived from the canonical
 *  sidebar plus a handful of "go to" shortcuts for high-traffic pages. */

import type { HubCommandRoute } from "@flink-reactor/ui"
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
  FileJson,
  FolderTree,
  GitFork,
  HardDrive,
  HeartPulse,
  Layers,
  LayoutDashboard,
  LineChart,
  Play,
  ScrollText,
  SearchCode,
  Server,
  Upload,
} from "lucide-react"

export const HUB_COMMAND_ROUTES: HubCommandRoute[] = [
  // Overview
  {
    label: "Overview",
    href: "/hub",
    icon: LayoutDashboard,
    group: "Overview",
    hint: "G O",
  },

  // Jobs
  {
    label: "Running jobs",
    href: "/hub/jobs/running",
    icon: Play,
    group: "Jobs",
    hint: "G R",
  },
  {
    label: "Completed jobs",
    href: "/hub/jobs/completed",
    icon: CheckCircle2,
    group: "Jobs",
  },
  {
    label: "Submit job",
    href: "/hub/jobs/submit",
    icon: Upload,
    group: "Jobs",
  },
  {
    label: "Deployments",
    href: "/hub/deployments",
    icon: ArrowLeftRight,
    group: "Jobs",
  },

  // Cluster
  {
    label: "Task managers",
    href: "/hub/task-managers",
    icon: Server,
    group: "Cluster",
    hint: "G T",
  },
  {
    label: "Job manager",
    href: "/hub/job-manager",
    icon: Cpu,
    group: "Cluster",
  },

  // Observe
  {
    label: "Health",
    href: "/hub/insights/health",
    icon: HeartPulse,
    group: "Observe",
  },
  {
    label: "Metrics",
    href: "/hub/insights/metrics",
    icon: LineChart,
    group: "Observe",
  },
  {
    label: "Bottlenecks",
    href: "/hub/insights/bottlenecks",
    icon: GitFork,
    group: "Observe",
  },
  {
    label: "Alerts",
    href: "/hub/monitoring/alerts",
    icon: BellRing,
    group: "Observe",
    hint: "G A",
  },
  {
    label: "Checkpoints",
    href: "/hub/monitoring/checkpoints",
    icon: BarChart3,
    group: "Observe",
  },

  // Logs
  {
    label: "Logs",
    href: "/hub/logs",
    icon: ScrollText,
    group: "Logs",
    hint: "G L",
  },
  {
    label: "Errors",
    href: "/hub/errors",
    icon: AlertTriangle,
    group: "Logs",
    hint: "G E",
  },

  // Data
  {
    label: "Materialized tables",
    href: "/hub/materialized-tables",
    icon: Database,
    group: "Data",
  },
  {
    label: "Catalogs",
    href: "/hub/catalogs",
    icon: FolderTree,
    group: "Data",
  },
  {
    label: "SQL explorer",
    href: "/hub/sql-explorer",
    icon: SearchCode,
    group: "Data",
    hint: "G S",
  },

  // Tools
  {
    label: "Sandbox (kitchen sink)",
    href: "/hub/sandbox",
    icon: Code2,
    group: "Tools",
    sublabel: "/hub/sandbox",
  },
  {
    label: "Simulations",
    href: "/hub/admin/simulations",
    icon: Activity,
    group: "Tools",
  },

  // Instruments
  {
    label: "Fluss",
    href: "/hub/instruments/fluss",
    icon: Layers,
    group: "Instruments",
  },
  {
    label: "Redis",
    href: "/hub/instruments/redis",
    icon: Database,
    group: "Instruments",
  },
  {
    label: "Schema registry",
    href: "/hub/instruments/schema-registry",
    icon: FileJson,
    group: "Instruments",
  },
  {
    label: "Database",
    href: "/hub/instruments/database",
    icon: HardDrive,
    group: "Instruments",
  },
]
