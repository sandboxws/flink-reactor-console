/**
 * @module simulation-preset-card
 *
 * Card component for a single simulation preset. Displays the preset name,
 * category badge, and description. Expands to show editable parameters and
 * a "Run" button that opens the preflight confirmation modal before launching.
 */

import { Badge, Button } from "@flink-reactor/ui"
import { Play } from "lucide-react"
import { useState } from "react"
import { cn } from "@/lib/cn"
import type {
  SimulationInputParams,
  SimulationPreset,
} from "@/lib/graphql-api-client"
import { SimulationPreflightModal } from "./simulation-preflight-modal"

/** Maps preset categories to their badge color tokens. */
const categoryColors: Record<string, string> = {
  resource: "bg-fr-purple/15 text-fr-purple",
  checkpoint: "bg-fr-amber/15 text-fr-amber",
  load: "bg-job-running/15 text-job-running",
  failure: "bg-job-failed/15 text-job-failed",
}

/**
 * Simulation preset card with expandable parameter editing and run action.
 *
 * Shows the preset description and category badge in collapsed state.
 * When expanded, renders input fields for each parameter from the preset's
 * default values. Clicking "Run" opens a preflight modal for confirmation.
 */
export function SimulationPresetCard({
  preset,
  onRun,
  isRunning,
}: {
  preset: SimulationPreset
  onRun: (input: SimulationInputParams) => Promise<void>
  isRunning: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [params, setParams] = useState<Record<string, unknown>>(
    preset.defaultParameters,
  )
  const [preflightOpen, setPreflightOpen] = useState(false)

  return (
    <div className="glass-card flex flex-col gap-2 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-zinc-200 truncate">
              {preset.name}
            </h3>
            <Badge
              variant="outline"
              className={cn(
                "shrink-0 border-0 text-[10px]",
                categoryColors[preset.category] ??
                  "bg-zinc-500/15 text-zinc-400",
              )}
            >
              {preset.category}
            </Badge>
          </div>
          <p className="mt-1 text-xs text-zinc-500 line-clamp-2">
            {preset.description}
          </p>
        </div>
      </div>

      {expanded && (
        <div className="mt-1 space-y-2 border-t border-dash-border pt-2">
          {Object.entries(params).map(([key, value]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="text-[10px] font-medium text-zinc-500 w-32 shrink-0">
                {key}
              </label>
              <input
                type="text"
                value={String(value)}
                onChange={(e) =>
                  setParams((p) => ({
                    ...p,
                    [key]: isNaN(Number(e.target.value))
                      ? e.target.value
                      : Number(e.target.value),
                  }))
                }
                className="flex-1 rounded-md bg-dash-surface px-2 py-1 text-xs text-zinc-200 border border-dash-border focus:border-fr-purple/50 focus:outline-none"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex justify-start gap-2 mt-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="text-[10px] text-zinc-500"
        >
          {expanded ? "Collapse" : "Configure"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={isRunning}
          onClick={() => setPreflightOpen(true)}
        >
          <Play className="mr-1 size-3" />
          Run
        </Button>
      </div>

      <SimulationPreflightModal
        open={preflightOpen}
        onOpenChange={setPreflightOpen}
        preset={preset}
        parameters={params}
        onLaunch={onRun}
      />
    </div>
  )
}
