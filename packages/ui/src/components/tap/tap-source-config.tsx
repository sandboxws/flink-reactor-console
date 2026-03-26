/** TAP source configuration form -- inputs for selecting target job, operator, and sample size. */
"use client"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible"
import { ChevronDown, ChevronRight, Settings } from "lucide-react"
import { useState } from "react"
import { cn } from "../../lib/cn"

/** Tap source configuration (pure subset of TapTab["config"]) */
export interface TapSourceConfigData {
  offsetMode: "latest" | "earliest" | "timestamp"
  startTimestamp?: string
  endTimestamp?: string
  bufferSize: number
}

interface TapSourceConfigProps {
  config: TapSourceConfigData
  consumerGroupId: string
  onConfigChange: (config: Partial<TapSourceConfigData>) => void
}

const OFFSET_MODES = [
  { value: "latest" as const, label: "Latest" },
  { value: "earliest" as const, label: "Earliest" },
  { value: "timestamp" as const, label: "Timestamp" },
]

/** Collapsible form for offset mode, timestamp range, buffer size, and consumer group ID. */
export function TapSourceConfig({
  config,
  consumerGroupId,
  onConfigChange,
}: TapSourceConfigProps) {
  const [open, setOpen] = useState(false)

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-zinc-300 transition-colors hover:bg-dash-hover">
        {open ? (
          <ChevronDown className="size-3.5 shrink-0 text-zinc-500" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0 text-zinc-500" />
        )}
        <Settings className="size-3.5 text-zinc-500" />
        Source Configuration
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="flex flex-col gap-3 px-3 pb-3 pt-1">
          {/* Offset Mode */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Offset Mode
            </label>
            <div className="flex gap-0.5 rounded-md bg-dash-surface p-0.5">
              {OFFSET_MODES.map((mode) => (
                <button
                  key={mode.value}
                  type="button"
                  onClick={() => onConfigChange({ offsetMode: mode.value })}
                  className={cn(
                    "flex-1 rounded px-3 py-1 text-xs font-medium transition-colors",
                    config.offsetMode === mode.value
                      ? "bg-fr-purple/20 text-fr-purple"
                      : "text-zinc-500 hover:text-zinc-300",
                  )}
                >
                  {mode.label}
                </button>
              ))}
            </div>
          </div>

          {/* Start timestamp picker -- only visible in timestamp mode */}
          {config.offsetMode === "timestamp" && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Start Timestamp
              </label>
              <input
                type="datetime-local"
                value={config.startTimestamp ?? ""}
                onChange={(e) =>
                  onConfigChange({ startTimestamp: e.target.value })
                }
                className="h-7 w-64 rounded-md border border-dash-border bg-dash-surface px-2 text-xs text-zinc-200 focus:border-fr-purple focus:outline-none"
              />
            </div>
          )}

          {/* Buffer Size */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Buffer Size (max rows)
            </label>
            <input
              type="number"
              value={config.bufferSize}
              min={100}
              max={100_000}
              step={1000}
              onChange={(e) =>
                onConfigChange({
                  bufferSize: Math.max(
                    100,
                    Math.min(100_000, Number(e.target.value) || 10_000),
                  ),
                })
              }
              className="h-7 w-32 rounded-md border border-dash-border bg-dash-surface px-2 text-xs tabular-nums text-zinc-200 focus:border-fr-purple focus:outline-none"
            />
          </div>

          {/* Consumer Group ID (read-only) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Consumer Group ID
            </label>
            <div className="rounded-md border border-dash-border/50 bg-dash-surface/50 px-2 py-1.5 font-mono text-[10px] text-zinc-500">
              {consumerGroupId || "Auto-generated on play"}
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
