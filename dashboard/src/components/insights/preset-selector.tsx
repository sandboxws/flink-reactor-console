/**
 * @module preset-selector
 * Quick-select dropdown for applying predefined metric presets from
 * {@link PRESETS}. Each button replaces the current metric selection
 * with a curated set of metrics for a specific monitoring scenario.
 */
import { Zap } from "lucide-react"
import { PRESETS } from "@/stores/metrics-explorer-store"

/** Props for {@link PresetSelector}. */
type PresetSelectorProps = {
  /** Callback invoked with the preset name when a preset button is clicked. */
  onApply: (presetName: string) => void
}

/**
 * Renders a row of preset buttons sourced from the {@link PRESETS} registry.
 * Clicking a button applies the corresponding metric preset via the parent
 * callback, replacing the current metric selection.
 */
export function PresetSelector({ onApply }: PresetSelectorProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        <Zap className="size-3" />
        Presets
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.keys(PRESETS).map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => onApply(name)}
            className="rounded-md border border-zinc-700 px-2.5 py-1 text-xs text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-200"
            title={`Apply ${name} preset`}
          >
            {name}
          </button>
        ))}
      </div>
    </div>
  )
}
