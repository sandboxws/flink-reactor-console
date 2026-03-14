import { cn } from "@/lib/cn"

type TimeRange = "LAST_1H" | "LAST_2H" | "LAST_24H" | "LAST_7D" | "LAST_30D"

const presets: { label: string; value: TimeRange }[] = [
  { label: "1 Hour", value: "LAST_1H" },
  { label: "2 Hours", value: "LAST_2H" },
  { label: "24 Hours", value: "LAST_24H" },
  { label: "7 Days", value: "LAST_7D" },
  { label: "30 Days", value: "LAST_30D" },
]

export function TimeFilterBar({
  active,
  onChange,
}: {
  active: TimeRange
  onChange: (range: TimeRange) => void
}) {
  return (
    <div className="flex items-center gap-1">
      {presets.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => onChange(p.value)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            active === p.value
              ? "bg-fr-coral/20 text-fr-coral"
              : "text-zinc-500 hover:bg-dash-panel hover:text-zinc-300",
          )}
        >
          {p.label}
        </button>
      ))}
    </div>
  )
}
