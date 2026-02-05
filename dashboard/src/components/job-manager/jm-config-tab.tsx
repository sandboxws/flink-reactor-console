"use client";

import { useMemo, useState } from "react";
import { Search, Settings } from "lucide-react";
import type { JobManagerConfig } from "@/data/cluster-types";
import { EmptyState } from "@/components/shared/empty-state";

// ---------------------------------------------------------------------------
// JmConfigTab — searchable key-value table for ~80 Flink config entries
// ---------------------------------------------------------------------------

export function JmConfigTab({ config }: { config: JobManagerConfig[] }) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return config;
    const lower = search.toLowerCase();
    return config.filter((c) => c.key.toLowerCase().includes(lower));
  }, [config, search]);

  if (config.length === 0) {
    return <EmptyState icon={Settings} message="No configuration available" />;
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search configuration..."
          className="h-8 w-full rounded-md border border-dash-border bg-dash-surface pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-fr-purple focus:outline-none"
        />
        {search && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-600">
            {filtered.length} / {config.length}
          </span>
        )}
      </div>

      {/* Config table */}
      <div className="glass-card overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border">
              <th className="px-3 py-2 text-left font-medium text-zinc-500">
                Key
              </th>
              <th className="px-3 py-2 text-left font-medium text-zinc-500">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr
                key={entry.key}
                className="border-b border-dash-border/50 even:bg-dash-panel transition-colors hover:bg-dash-hover"
              >
                <td className="w-1/2 px-3 py-1.5 font-mono text-zinc-300">
                  {entry.key}
                </td>
                <td className="w-1/2 px-3 py-1.5 font-mono text-zinc-400 break-all">
                  {entry.value}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-zinc-500">
            No matching configuration entries
          </div>
        )}
      </div>
    </div>
  );
}
