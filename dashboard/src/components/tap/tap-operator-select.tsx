"use client";

import { Radio, ArrowRight, Database, Shuffle, GitMerge } from "lucide-react";
import type { TapMetadata } from "@/data/tap-types";
import { cn } from "@/lib/cn";

interface TapOperatorSelectProps {
  operators: TapMetadata[];
  onSelect: (nodeId: string) => void;
  disabledNodeIds?: string[];
}

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  source: Database,
  transform: Shuffle,
  join: GitMerge,
  window: ArrowRight,
  sink: Radio,
};

const TYPE_LABELS: Record<string, string> = {
  source: "Sources",
  transform: "Transforms",
  join: "Joins",
  window: "Windows",
  sink: "Sinks",
};

/**
 * Dropdown selector showing available tapped operators grouped by component type.
 * Disables operators that already have open tabs.
 */
export function TapOperatorSelect({
  operators,
  onSelect,
  disabledNodeIds = [],
}: TapOperatorSelectProps) {
  // Group operators by component type
  const groups = new Map<string, TapMetadata[]>();
  for (const op of operators) {
    const list = groups.get(op.componentType) ?? [];
    list.push(op);
    groups.set(op.componentType, list);
  }

  const groupOrder = ["source", "transform", "join", "window", "sink"];
  const sortedGroups = [...groups.entries()].sort(
    (a, b) =>
      (groupOrder.indexOf(a[0]) ?? 99) - (groupOrder.indexOf(b[0]) ?? 99),
  );

  return (
    <div className="glass-card divide-y divide-dash-border/50 overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 text-xs font-medium text-zinc-300">
        <Radio className="size-3.5 text-fr-purple" />
        Select an operator to observe
      </div>
      {sortedGroups.map(([type, ops]) => {
        const Icon = TYPE_ICONS[type] ?? Radio;
        const label = TYPE_LABELS[type] ?? type;

        return (
          <div key={type}>
            <div className="flex items-center gap-2 px-4 py-2 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              <Icon className="size-3" />
              {label}
            </div>
            <div className="pb-1">
              {ops.map((op) => {
                const isDisabled = disabledNodeIds.includes(op.nodeId);

                return (
                  <button
                    key={op.nodeId}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => onSelect(op.nodeId)}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-2 text-left text-xs transition-colors",
                      isDisabled
                        ? "cursor-not-allowed text-zinc-600"
                        : "text-zinc-300 hover:bg-dash-hover hover:text-zinc-100",
                    )}
                  >
                    <span className="flex-1 truncate font-medium">
                      {op.name}
                    </span>
                    <span className="shrink-0 rounded bg-dash-elevated px-1.5 py-0.5 font-mono text-[10px] text-zinc-500">
                      {op.connectorType}
                    </span>
                    {isDisabled && (
                      <span className="shrink-0 text-[10px] text-zinc-600">
                        open
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
