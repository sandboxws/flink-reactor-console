import { Activity } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"

export function TmProfilerTab() {
  return (
    <div className="pt-4">
      <EmptyState icon={Activity} message="Profiler not yet available" />
    </div>
  )
}
