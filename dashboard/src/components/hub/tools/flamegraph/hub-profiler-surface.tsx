/**
 * HubProfilerSurface — the Hub's profiler tab body. It offers two clearly
 * distinct tools behind a segmented toggle:
 *
 *   1. **Operator flame graph** (FLIP-165) — the existing ProfilerPicker, which
 *      samples a single operator's on/off-CPU stacks.
 *   2. **JVM async profiler** (FLIP-375) — the whole-JVM async profiler
 *      (CPU / allocation / lock / wall-clock), capability-gated.
 *
 * Keeping them side-by-side (never merged) is the point: the audit found the
 * two conflated, and this surface makes the distinction explicit.
 */

import { Activity, Flame } from "lucide-react"
import { useState } from "react"
import { AsyncProfilerPanel } from "@/components/shared/async-profiler-panel"
import { cn } from "@/lib/cn"
import {
  listJobManagerProfilerInstances,
  listTaskManagerProfilerInstances,
  triggerJobManagerProfiler,
  triggerTaskManagerProfiler,
} from "@/lib/profiler-data"
import { useClusterStore } from "@/stores/cluster-store"
import { ProfilerPicker } from "./profiler-picker"

type Tool = "operator" | "async"

interface HubProfilerSurfaceProps {
  /** Pre-filters vertices in the operator picker (TM-detail case). */
  vertexFilter?: (vertexId: string) => boolean
  /** TaskManager id when profiling a specific TM; omit for the JobManager. */
  taskManagerId?: string
}

export function HubProfilerSurface({
  vertexFilter,
  taskManagerId,
}: HubProfilerSurfaceProps) {
  const [tool, setTool] = useState<Tool>("operator")
  const capabilities = useClusterStore((s) => s.overview?.capabilities)
  const asyncEnabled = (capabilities ?? []).includes("ASYNC_PROFILER")

  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md border border-dash-border bg-dash-panel p-0.5">
        <ToggleButton
          icon={Flame}
          active={tool === "operator"}
          onClick={() => setTool("operator")}
        >
          Operator flame graph
        </ToggleButton>
        <ToggleButton
          icon={Activity}
          active={tool === "async"}
          onClick={() => setTool("async")}
        >
          JVM async profiler
        </ToggleButton>
      </div>

      {tool === "operator" ? (
        <ProfilerPicker vertexFilter={vertexFilter} />
      ) : taskManagerId ? (
        <AsyncProfilerPanel
          targetLabel={`TaskManager ${taskManagerId}`}
          enabled={asyncEnabled}
          onTrigger={(mode, duration) =>
            triggerTaskManagerProfiler(taskManagerId, mode, duration)
          }
          onList={() => listTaskManagerProfilerInstances(taskManagerId)}
        />
      ) : (
        <AsyncProfilerPanel
          targetLabel="JobManager"
          enabled={asyncEnabled}
          onTrigger={(mode, duration) =>
            triggerJobManagerProfiler(mode, duration)
          }
          onList={() => listJobManagerProfilerInstances()}
        />
      )}
    </div>
  )
}

function ToggleButton({
  icon: Icon,
  active,
  onClick,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-dash-elevated text-fg" : "text-fg-muted hover:text-fg",
      )}
    >
      <Icon className="size-3.5" />
      {children}
    </button>
  )
}
