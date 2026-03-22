"use client"

import { cn } from "../lib/cn"

export interface TimeRangePreset {
  label: string
  minutes: number
}

const DEFAULT_PRESETS: TimeRangePreset[] = [
  { label: "5m", minutes: 5 },
  { label: "15m", minutes: 15 },
  { label: "1h", minutes: 60 },
  { label: "6h", minutes: 360 },
  { label: "24h", minutes: 1440 },
  { label: "All", minutes: 0 },
]

export interface TimeRangeValue {
  start?: Date
  end?: Date
}

export type TimeRangeVariant = "mini" | "full"

export interface TimeRangeProps {
  /** Current time range value */
  value: TimeRangeValue
  /** Called when a preset is selected */
  onChange: (value: TimeRangeValue) => void
  /** Custom presets (default: 5m, 15m, 1h, 6h, 24h, All) */
  presets?: TimeRangePreset[]
  /** Visual variant — mini (compact toolbar widget) or full (standalone filter bar) */
  variant?: TimeRangeVariant
  className?: string
}

const containerStyles: Record<TimeRangeVariant, string> = {
  mini: "flex items-center gap-0.5 rounded-md border border-dash-border bg-dash-surface px-1 py-0.5",
  full: "flex items-center gap-1",
}

const buttonBase: Record<TimeRangeVariant, string> = {
  mini: "rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors",
  full: "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
}

const buttonActive: Record<TimeRangeVariant, string> = {
  mini: "bg-white/[0.1] text-white",
  full: "bg-fr-coral/20 text-fr-coral",
}

const buttonInactive: Record<TimeRangeVariant, string> = {
  mini: "text-zinc-500 hover:text-zinc-300",
  full: "text-zinc-500 hover:bg-dash-panel hover:text-zinc-300",
}

/**
 * TimeRange — preset time range selector.
 *
 * Provides quick selection of common time ranges for filtering logs/data.
 * Two visual variants: `mini` (compact toolbar widget) and `full` (standalone filter bar).
 */
export function TimeRange({
  value,
  onChange,
  presets = DEFAULT_PRESETS,
  variant = "mini",
  className,
}: TimeRangeProps) {
  const isAll = !value.start && !value.end

  function selectPreset(minutes: number) {
    if (minutes === 0) {
      onChange({})
    } else {
      const end = new Date()
      const start = new Date(end.getTime() - minutes * 60_000)
      onChange({ start, end })
    }
  }

  // Determine which preset is active (approximate)
  function isPresetActive(minutes: number): boolean {
    if (minutes === 0) return isAll
    if (!value.start) return false
    const diff = (Date.now() - value.start.getTime()) / 60_000
    return Math.abs(diff - minutes) < minutes * 0.1
  }

  return (
    <div
      className={cn(
        containerStyles[variant],
        className,
      )}
    >
      {presets.map((preset) => (
        <button
          key={preset.label}
          type="button"
          onClick={() => selectPreset(preset.minutes)}
          className={cn(
            buttonBase[variant],
            isPresetActive(preset.minutes)
              ? buttonActive[variant]
              : buttonInactive[variant],
          )}
        >
          {preset.label}
        </button>
      ))}
    </div>
  )
}
