import { Cpu } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function JmThreadDumpTab() {
  return (
    <div className="pt-4">
      <EmptyState icon={Cpu} message="Thread dump not yet available" />
    </div>
  );
}
