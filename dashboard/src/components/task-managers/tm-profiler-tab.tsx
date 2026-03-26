/**
 * @module tm-profiler-tab
 *
 * Placeholder tab for the task manager CPU/memory profiler.
 * Currently displays an empty state; profiling integration is planned.
 */
import { Activity } from "lucide-react"
import { EmptyState } from "@flink-reactor/ui"

/** Placeholder profiler tab that shows an "not yet available" empty state. */
export function TmProfilerTab() {
  return (
    <div className="pt-4">
      <EmptyState icon={Activity} message="Profiler not yet available" />
    </div>
  )
}
