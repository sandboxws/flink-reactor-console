"use client"

import { Zap } from "lucide-react"
import { cn } from "@/lib/cn"
import type { MetricSource } from "@/stores/metrics-explorer-store"
import { PRESETS } from "@/stores/metrics-explorer-store"

type PresetSelectorProps = {
  selectedSource: MetricSource | null
  onApply: (presetName: string) => void
}

export function PresetSelector({
  selectedSource,
  onApply,
}: PresetSelectorProps) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-1.5 px-1 text-[10px] font-medium uppercase tracking-wider text-zinc-600">
        <Zap className="size-3" />
        Presets
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {Object.entries(PRESETS).map(([name, preset]) => {
          const needsJobVertex =
            preset.source === "job-vertex" &&
            (!selectedSource || selectedSource.type !== "job-vertex")

          return (
            <button
              key={name}
              type="button"
              onClick={() => !needsJobVertex && onApply(name)}
              disabled={needsJobVertex}
              className={cn(
                "rounded-md border px-2.5 py-1 text-xs transition-colors",
                needsJobVertex
                  ? "cursor-not-allowed border-zinc-800 text-zinc-600"
                  : "border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-zinc-200",
              )}
              title={
                needsJobVertex
                  ? "Requires job + vertex selection"
                  : `Apply ${name} preset`
              }
            >
              {name}
            </button>
          )
        })}
      </div>
    </div>
  )
}
