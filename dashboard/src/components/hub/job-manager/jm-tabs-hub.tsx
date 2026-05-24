/**
 * Hub-styled 8-tab strip for the job-manager detail.
 *
 * Tabs: Config / Metrics / Logs / StdOut / Classpath / JVM / Threads /
 * Profiler. Active tab is reflected in `?tab=...` so the URL stays
 * shareable. Profiler tab is a placeholder until P4.
 */

import type { LucideIcon } from "lucide-react"
import {
  Activity,
  AlignLeft,
  FileBarChart,
  ScrollText,
  Settings2,
  Sigma,
} from "lucide-react"

export type JmTab =
  | "config"
  | "metrics"
  | "logs"
  | "stdout"
  | "threads"
  | "profiler"

interface JmTabSpec {
  id: JmTab
  label: string
  icon: LucideIcon
}

export const JM_TABS: readonly JmTabSpec[] = [
  { id: "config", label: "Configuration", icon: Settings2 },
  { id: "metrics", label: "Metrics", icon: FileBarChart },
  { id: "logs", label: "Logs", icon: ScrollText },
  { id: "stdout", label: "StdOut", icon: AlignLeft },
  { id: "threads", label: "Threads", icon: Sigma },
  { id: "profiler", label: "Profiler", icon: Activity },
]

interface JmTabsHubProps {
  active: JmTab
  onChange: (id: JmTab) => void
}

export function JmTabsHub({ active, onChange }: JmTabsHubProps) {
  return (
    <div
      className="flex flex-wrap items-center gap-1 border-b border-dash-border"
      role="tablist"
    >
      {JM_TABS.map((t) => {
        const Icon = t.icon
        const isActive = t.id === active
        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            className={`tab ${isActive ? "active" : ""}`}
            onClick={() => onChange(t.id)}
          >
            <Icon className="size-3.5" />
            {t.label}
          </button>
        )
      })}
    </div>
  )
}
