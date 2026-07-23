/**
 * @module tm-profiler-tab
 *
 * TaskManager JVM async-profiler tab (FLIP-375). Delegates to the shared
 * AsyncProfilerPanel, wired to this TaskManager's profiler endpoints and gated
 * on the cluster's ASYNC_PROFILER capability.
 */

import { AsyncProfilerPanel } from "@/components/shared/async-profiler-panel"
import {
  listTaskManagerProfilerInstances,
  triggerTaskManagerProfiler,
} from "@/lib/profiler-data"
import { useClusterStore } from "@/stores/cluster-store"

/** Async-profiler tab for a single TaskManager. */
export function TmProfilerTab({ tmId }: { tmId: string }) {
  const capabilities = useClusterStore((s) => s.overview?.capabilities)
  const enabled = (capabilities ?? []).includes("ASYNC_PROFILER")

  return (
    <AsyncProfilerPanel
      targetLabel={`TaskManager ${tmId}`}
      enabled={enabled}
      onTrigger={(mode, duration) =>
        triggerTaskManagerProfiler(tmId, mode, duration)
      }
      onList={() => listTaskManagerProfilerInstances(tmId)}
    />
  )
}
