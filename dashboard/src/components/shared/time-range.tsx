import { cn } from "@/lib/cn"
import { useFilterStore } from "@/stores/filter-store"

const PRESETS = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
  { label: "All", minutes: 0 },
] as const

export function TimeRange() {
  const timeRange = useFilterStore((s) => s.timeRange)
  const setTimeRange = useFilterStore((s) => s.setTimeRange)
  const clearTimeRange = useFilterStore((s) => s.clearTimeRange)

  const isAll = !timeRange.start && !timeRange.end

  function selectPreset(minutes: number) {
    if (minutes === 0) {
      clearTimeRange()
    } else {
      const end = new Date()
      const start = new Date(end.getTime() - minutes * 60_000)
      setTimeRange(start, end)
    }
  }

  // Determine which preset is active (approximate)
  function isPresetActive(minutes: number): boolean {
    if (minutes === 0) return isAll
    if (!timeRange.start) return false
    const diff = (Date.now() - timeRange.start.getTime()) / 60_000
    return Math.abs(diff - minutes) < minutes * 0.1
  }

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-dash-border bg-dash-surface px-1 py-0.5">
      {PRESETS.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => selectPreset(preset.minutes)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
            isPresetActive(preset.minutes)
              ? "bg-white/[0.1] text-white"
              : "text-zinc-500 hover:text-zinc-300",
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
