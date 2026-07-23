/**
 * @module jm-profiler-tab
 *
 * JobManager JVM async-profiler tab (FLIP-375). Delegates to the shared
 * AsyncProfilerPanel, wired to the JobManager profiler endpoints and gated on
 * the cluster's ASYNC_PROFILER capability.
 */

import { AsyncProfilerPanel } from "@/components/shared/async-profiler-panel"
import {
  listJobManagerProfilerInstances,
  triggerJobManagerProfiler,
} from "@/lib/profiler-data"
import { useClusterStore } from "@/stores/cluster-store"

/** Async-profiler tab for the JobManager. */
export function JmProfilerTab() {
  const capabilities = useClusterStore((s) => s.overview?.capabilities)
  const enabled = (capabilities ?? []).includes("ASYNC_PROFILER")

  return (
    <AsyncProfilerPanel
      targetLabel="JobManager"
      enabled={enabled}
      onTrigger={(mode, duration) => triggerJobManagerProfiler(mode, duration)}
      onList={() => listJobManagerProfilerInstances()}
    />
  )
}
