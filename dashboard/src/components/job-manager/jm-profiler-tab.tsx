import { Activity } from "lucide-react"
import { EmptyState } from "@flink-reactor/ui"

export function JmProfilerTab() {
  return (
    <div className="pt-4">
      <EmptyState icon={Activity} message="Profiler not yet available" />
    </div>
  )
}
