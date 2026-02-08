"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { Search, Settings } from "lucide-react";
import type { JobManagerConfig } from "@/data/cluster-types";
import { EmptyState } from "@/components/shared/empty-state";
import { TagBadge, TagChip, classifyConfigKey } from "./tag-filter";

// ---------------------------------------------------------------------------
// JmConfigSection — searchable key-value table with tag filtering
// ---------------------------------------------------------------------------

export function JmConfigSection({ config }: { config: JobManagerConfig[] }) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const scrollYRef = useRef(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const naturalHeightRef = useRef(0);

  // Tag each config entry
  const taggedConfig = useMemo(
    () => config.map((c) => ({ ...c, tag: classifyConfigKey(c.key) })),
    [config],
  );

  // Compute tag counts
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of taggedConfig) {
      counts.set(entry.tag, (counts.get(entry.tag) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [taggedConfig]);

  // Apply both filters (AND logic)
  const filtered = useMemo(() => {
    let results = taggedConfig;
    if (activeTag) {
      results = results.filter((c) => c.tag === activeTag);
    }
    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(
        (c) =>
          c.key.toLowerCase().includes(lower) ||
          c.value.toLowerCase().includes(lower),
      );
    }
    return results;
  }, [taggedConfig, activeTag, search]);

  const isFiltered = activeTag !== null || search !== "";

  // Stabilize page height during filtering to prevent scroll jump
  useLayoutEffect(() => {
    const el = tableRef.current;
    if (!el) return;

    if (!isFiltered) {
      el.style.minHeight = "";
      naturalHeightRef.current = el.offsetHeight;
    } else if (naturalHeightRef.current > 0) {
      el.style.minHeight = `${naturalHeightRef.current}px`;
    }

    window.scrollTo(0, scrollYRef.current);
  }, [filtered, isFiltered]);

  if (config.length === 0) {
    return <EmptyState icon={Settings} message="No configuration available" />;
  }

  return (
    <div className="glass-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-dash-border px-4 py-3">
        <Settings className="size-3.5 text-zinc-500" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Configurations
        </h3>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">
          {config.length} entries
        </span>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 px-4 pt-3 pb-2">
        {/* Tag chips */}
        <div className="flex flex-wrap gap-1.5">
          {tagCounts.map(({ tag, count }) => (
            <TagChip
              key={tag}
              tag={tag}
              count={count}
              active={activeTag === tag}
              onClick={() => {
                scrollYRef.current = window.scrollY;
                setActiveTag((prev) => (prev === tag ? null : tag));
              }}
            />
          ))}
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              scrollYRef.current = window.scrollY;
              setSearch(e.target.value);
            }}
            placeholder="Search configuration..."
            className="h-8 w-full rounded-md border border-dash-border bg-dash-surface pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-fr-purple focus:outline-none"
          />
          {(search || activeTag) && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-600">
              {filtered.length} / {config.length}
            </span>
          )}
        </div>
      </div>

      {/* Config table */}
      <div ref={tableRef}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border">
              <th className="px-4 py-2 text-left font-medium text-zinc-500">
                Key
              </th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">
                Value
              </th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">
                Tag
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr
                key={entry.key}
                className="border-b border-dash-border/50 even:bg-dash-panel transition-colors hover:bg-dash-hover"
              >
                <td className="w-5/12 px-4 py-1.5 font-mono text-zinc-300">
                  {entry.key}
                </td>
                <td className="w-5/12 px-4 py-1.5 font-mono text-zinc-400 break-all">
                  {entry.value}
                </td>
                <td className="w-2/12 px-4 py-1.5">
                  <TagBadge tag={entry.tag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">
            No matching configuration entries
          </div>
        )}
      </div>
    </div>
  );
}
