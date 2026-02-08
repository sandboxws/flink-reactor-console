import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";

export function JmLogListTab() {
  return (
    <div className="pt-4">
      <EmptyState icon={FileText} message="Log list not yet available" />
    </div>
  );
}
