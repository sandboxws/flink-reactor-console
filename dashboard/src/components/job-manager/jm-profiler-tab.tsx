/**
 * @module jm-profiler-tab
 *
 * Placeholder tab for the Job Manager CPU/memory profiler. Currently
 * renders an empty state; will be wired to a profiling backend in a
 * future iteration.
 */

import { Activity } from "lucide-react"
import { EmptyState } from "@flink-reactor/ui"

/** Profiler tab placeholder showing a "not yet available" empty state. */
export function JmProfilerTab() {
  return (
    <div className="pt-4">
      <EmptyState icon={Activity} message="Profiler not yet available" />
    </div>
  )
}
