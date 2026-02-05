import { cn } from "@/lib/cn";

export function MetricCard({
  icon: Icon,
  label,
  value,
  accent,
  className,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
  accent?: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("glass-card p-4", className)}>
      <div className="flex items-center gap-2 text-zinc-500">
        <Icon className={cn("size-4", accent)} />
        <span className="text-xs font-medium uppercase tracking-wide">
          {label}
        </span>
      </div>
      <div className="mt-2 text-2xl font-semibold text-zinc-100">{value}</div>
      {children}
    </div>
  );
}
