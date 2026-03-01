"use client";

import { Trash2 } from "lucide-react";
import type { AlertRule } from "@/stores/alerts-store";
import { cn } from "@/lib/cn";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type RuleListProps = {
  rules: AlertRule[];
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
};

const SEVERITY_BADGE = {
  critical: "text-job-failed bg-job-failed/10",
  warning: "text-fr-amber bg-fr-amber/10",
  info: "text-fr-purple bg-fr-purple/10",
} as const;

const CONDITION_LABELS: Record<string, string> = {
  ">": ">",
  "<": "<",
  "==": "=",
  "!=": "!=",
  ">=": ">=",
  "<=": "<=",
};

export function RuleList({ rules, onToggle, onDelete }: RuleListProps) {
  if (rules.length === 0) {
    return (
      <div className="glass-card flex items-center justify-center py-8 text-xs text-zinc-600">
        No rules configured
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border">
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                On
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Name
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Metric
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Condition
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Threshold
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Polls
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Severity
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {rules.map((rule) => (
              <tr
                key={rule.id}
                className="border-b border-dash-border/50 transition-colors hover:bg-white/[0.02]"
              >
                <td className="px-3 py-2">
                  <Switch
                    checked={rule.enabled}
                    onCheckedChange={() => onToggle(rule.id)}
                  />
                </td>
                <td className="px-3 py-2 font-medium text-zinc-200">
                  {rule.name}
                  {rule.isPreset && (
                    <span className="ml-1.5 text-[10px] text-zinc-600">
                      preset
                    </span>
                  )}
                </td>
                <td className="max-w-32 truncate px-3 py-2 text-zinc-400">
                  {rule.metric}
                </td>
                <td className="px-3 py-2 text-zinc-400">
                  {CONDITION_LABELS[rule.condition] ?? rule.condition}
                </td>
                <td className="px-3 py-2 text-zinc-300">{rule.threshold}</td>
                <td className="px-3 py-2 text-zinc-400">
                  {rule.requiredConsecutive}
                </td>
                <td className="px-3 py-2">
                  <span
                    className={cn(
                      "inline-block rounded px-1.5 py-0.5 text-[10px] font-medium",
                      SEVERITY_BADGE[rule.severity],
                    )}
                  >
                    {rule.severity}
                  </span>
                </td>
                <td className="px-3 py-2">
                  {rule.isPreset ? (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed text-zinc-700"
                          >
                            <Trash2 className="size-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Cannot delete preset rules
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onDelete(rule.id)}
                      className="text-zinc-500 transition-colors hover:text-job-failed"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
