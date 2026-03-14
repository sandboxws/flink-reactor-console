import { Zap } from "lucide-react"
import { PRESETS } from "@/stores/metrics-explorer-store"

type PresetSelectorProps = {
  onApply: (presetName: string) => void
}

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
