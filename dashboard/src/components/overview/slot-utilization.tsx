import { Layers } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/cn";

export function SlotUtilization({
  available,
  total,
}: {
  available: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((available / total) * 100) : 0;

  // Color gradient based on availability percentage
  const color =
    pct > 50
      ? "text-job-running" // green — healthy
      : pct >= 10
        ? "text-fr-amber" // amber — getting low
        : "text-job-failed"; // red — critical

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 text-zinc-500">
        <Layers className={cn("size-4", color)} />
        <span className="text-xs font-medium uppercase tracking-wide">
          Slot Utilization
        </span>
      </div>

      <div className="mt-3 flex items-baseline justify-between">
        <span className="text-2xl font-semibold text-zinc-100">
          {available}
          <span className="text-sm font-normal text-zinc-500"> / {total}</span>
        </span>
        <span className={cn("text-sm font-medium", color)}>{pct}% free</span>
      </div>

      <Progress value={pct} className="mt-3" />
    </div>
  );
}
