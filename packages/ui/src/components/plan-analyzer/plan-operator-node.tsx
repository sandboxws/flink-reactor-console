"use client"

import {
  HoverCard,
  HoverCardArrow,
  HoverCardContent,
  HoverCardTrigger,
} from "../ui/hover-card"
import type { NodeProps } from "@xyflow/react"
import { Handle, Position } from "@xyflow/react"
import { AlertTriangle, Info, OctagonAlert } from "lucide-react"
import { cn } from "../../lib/cn"
import type {
  FlinkAntiPattern,
  FlinkOperatorCategory,
  FlinkOperatorNode,
  StateGrowthForecast,
} from "../../types/plan-analyzer"

// ---------------------------------------------------------------------------
// Category -> color mapping (matches console job graph palette)
// ---------------------------------------------------------------------------

const CATEGORY_COLORS: Record<
  FlinkOperatorCategory,
  { bg: string; text: string; border: string }
> = {
  source: {
    bg: "bg-fr-coral/10",
    text: "text-fr-coral",
    border: "border-t-fr-coral",
  },
  sink: {
    bg: "bg-fr-amber/10",
    text: "text-fr-amber",
    border: "border-t-fr-amber",
  },
  transformation: {
    bg: "bg-fr-purple/10",
    text: "text-fr-purple",
    border: "border-t-fr-purple",
  },
  aggregation: {
    bg: "bg-fr-purple/10",
    text: "text-fr-purple",
    border: "border-t-fr-purple",
  },
  window: {
    bg: "bg-fr-purple/10",
    text: "text-fr-purple",
    border: "border-t-fr-purple",
  },
  join: {
    bg: "bg-fr-purple/10",
    text: "text-fr-purple",
    border: "border-t-fr-purple",
  },
  deduplication: {
    bg: "bg-fr-purple/10",
    text: "text-fr-purple",
    border: "border-t-fr-purple",
  },
  cep: {
    bg: "bg-fr-purple/10",
    text: "text-fr-purple",
    border: "border-t-fr-purple",
  },
  exchange: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-t-zinc-500",
  },
  unknown: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    border: "border-t-zinc-500",
  },
}

// ---------------------------------------------------------------------------
// Severity badge
// ---------------------------------------------------------------------------

function SeverityBadge({
  count,
  severity,
}: {
  count: number
  severity: "critical" | "warning" | "info"
}) {
  if (count === 0) return null

  const Icon =
    severity === "critical"
      ? OctagonAlert
      : severity === "warning"
        ? AlertTriangle
        : Info

  const color =
    severity === "critical"
      ? "text-job-failed bg-job-failed/15"
      : severity === "warning"
        ? "text-fr-amber bg-fr-amber/15"
        : "text-zinc-400 bg-zinc-500/15"

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[9px] font-medium",
        color,
      )}
    >
      <Icon className="size-2.5" />
      {count}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Format helpers
// ---------------------------------------------------------------------------

function formatBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

// ---------------------------------------------------------------------------
// Plan operator node
// ---------------------------------------------------------------------------

export type PlanOperatorNodeData = {
  node: FlinkOperatorNode
  antiPatterns: FlinkAntiPattern[]
  stateForecasts: StateGrowthForecast[]
  isSelected: boolean
  onSelect?: (nodeId: string) => void
}

export function PlanOperatorNode({
  data,
}: NodeProps & { data: PlanOperatorNodeData }) {
  const { node, antiPatterns, stateForecasts, isSelected } = data
  const colors = CATEGORY_COLORS[node.category] ?? CATEGORY_COLORS.unknown

  const displayName =
    node.relation ||
    node.operation?.replace(/^(Source|Sink):\s*/, "") ||
    node.operatorType

  const criticalCount = antiPatterns.filter(
    (p) => p.severity === "critical",
  ).length
  const warningCount = antiPatterns.filter(
    (p) => p.severity === "warning",
  ).length
  const infoCount = antiPatterns.filter((p) => p.severity === "info").length

  const forecast = stateForecasts[0]

  const nodeContent = (
    <div
      className={cn(
        "relative z-10 w-[320px] overflow-hidden rounded-xl border border-white/6 bg-dash-panel transition-shadow",
        isSelected && "ring-1 ring-fr-purple/50 shadow-lg shadow-fr-purple/10",
      )}
    >
      <Handle
        type="target"
        position={Position.Left}
        className="!bg-dash-border !border-dash-elevated !size-2"
      />

      {/* -- Header -- */}
      <div className={cn("flex items-center gap-2 px-3 py-2", colors.bg)}>
        <span
          className={cn(
            "shrink-0 rounded px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wider",
            colors.text,
            colors.bg,
          )}
        >
          {node.category}
        </span>
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">
          {displayName}
        </span>
        <SeverityBadge count={criticalCount} severity="critical" />
        <SeverityBadge count={warningCount} severity="warning" />
      </div>

      {/* -- Body: operator details -- */}
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 px-3 py-2 text-[10px]">
        <span className="text-zinc-500">Type</span>
        <span className="text-right text-zinc-300">{node.operatorType}</span>

        <span className="text-zinc-500">Parallelism</span>
        <span className="text-right tabular-nums text-zinc-300">
          &times;{node.parallelism}
        </span>

        {node.groupByKeys && node.groupByKeys.length > 0 && (
          <>
            <span className="text-zinc-500">Group By</span>
            <span className="truncate text-right text-zinc-300">
              {node.groupByKeys.join(", ")}
            </span>
          </>
        )}

        {node.joinInfo && (
          <>
            <span className="text-zinc-500">Join</span>
            <span className="text-right text-zinc-300">
              {node.joinInfo.joinType}
            </span>
          </>
        )}

        {node.windowInfo && (
          <>
            <span className="text-zinc-500">Window</span>
            <span className="text-right text-zinc-300">
              {node.windowInfo.windowType}
            </span>
          </>
        )}

        {forecast && (
          <>
            <span className="text-zinc-500">State (24h)</span>
            <span
              className={cn(
                "text-right tabular-nums",
                forecast.growthPattern === "unbounded"
                  ? "text-job-failed"
                  : forecast.growthPattern === "linear"
                    ? "text-fr-amber"
                    : "text-zinc-300",
              )}
            >
              {formatBytes(forecast.estimatedSize24h)}
            </span>
          </>
        )}

        {node.changelogMode && node.category === "sink" && (
          <>
            <span className="text-zinc-500">Changelog</span>
            <span className="text-right text-zinc-300">
              {node.changelogMode}
            </span>
          </>
        )}
      </div>

      {/* -- Footer: click to view details -- */}
      {(criticalCount > 0 || warningCount > 0 || infoCount > 0) &&
        data.onSelect && (
          <div className="border-t border-white/5 px-3 py-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                data.onSelect?.(node.id)
              }}
              className="text-[10px] text-zinc-500 transition-colors hover:text-fr-purple"
            >
              View {criticalCount + warningCount + infoCount} issue
              {criticalCount + warningCount + infoCount !== 1 && "s"} &rarr;
            </button>
          </div>
        )}

      <Handle
        type="source"
        position={Position.Right}
        className="!bg-dash-border !border-dash-elevated !size-2"
      />
    </div>
  )

  // Hover card with full anti-pattern list
  if (antiPatterns.length === 0) return nodeContent

  return (
    <HoverCard openDelay={400} closeDelay={150}>
      <HoverCardTrigger asChild>{nodeContent}</HoverCardTrigger>
      <HoverCardContent
        side="right"
        align="start"
        sideOffset={12}
        className="w-80 overflow-hidden border-dash-border bg-dash-panel p-0"
      >
        <HoverCardArrow className="fill-dash-panel" />

        <div className="border-b border-white/5 px-3 py-2">
          <div className="text-sm font-semibold text-zinc-100">
            {node.operation || node.operatorType}
          </div>
          <div className="mt-0.5 flex items-center gap-2">
            <span className={cn("text-xs font-medium capitalize", colors.text)}>
              {node.category}
            </span>
            <span className="text-xs text-zinc-500">
              &times;{node.parallelism} parallelism
            </span>
          </div>
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto px-3 py-2">
          {antiPatterns.map((ap) => (
            <div key={ap.id} className="text-xs">
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "size-1.5 shrink-0 rounded-full",
                    ap.severity === "critical"
                      ? "bg-job-failed"
                      : ap.severity === "warning"
                        ? "bg-fr-amber"
                        : "bg-zinc-500",
                  )}
                />
                <span className="font-medium text-zinc-200">{ap.title}</span>
              </div>
              <p className="mt-0.5 text-zinc-500">{ap.suggestion}</p>
            </div>
          ))}
        </div>
      </HoverCardContent>
    </HoverCard>
  )
}
