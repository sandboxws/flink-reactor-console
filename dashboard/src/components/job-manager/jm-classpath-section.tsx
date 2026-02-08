"use client";

import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { FolderOpen, Search } from "lucide-react";
import type { ClasspathEntry } from "@/data/cluster-types";
import { TagBadge, TagChip } from "./tag-filter";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const MB = 1024 ** 2;
const KB = 1024;

function formatSize(bytes: number): string {
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`;
  if (bytes >= KB) return `${(bytes / KB).toFixed(0)} KB`;
  return `${bytes} B`;
}

// ---------------------------------------------------------------------------
// JmClasspathSection — classpath table with tag and text filtering
// ---------------------------------------------------------------------------

export function JmClasspathSection({
  classpath,
}: {
  classpath: ClasspathEntry[];
}) {
  const [search, setSearch] = useState("");
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const scrollYRef = useRef(0);
  const tableRef = useRef<HTMLDivElement>(null);
  const naturalHeightRef = useRef(0);

  // Compute tag counts
  const tagCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of classpath) {
      counts.set(entry.tag, (counts.get(entry.tag) ?? 0) + 1);
    }
    // Sort by count descending
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([tag, count]) => ({ tag, count }));
  }, [classpath]);

  // Apply both filters (AND logic)
  const filtered = useMemo(() => {
    let results = classpath;
    if (activeTag) {
      results = results.filter((e) => e.tag === activeTag);
    }
    if (search) {
      const lower = search.toLowerCase();
      results = results.filter(
        (e) =>
          e.filename.toLowerCase().includes(lower) ||
          e.path.toLowerCase().includes(lower),
      );
    }
    return results;
  }, [classpath, activeTag, search]);

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

  return (
    <div className="glass-card overflow-hidden">
      {/* Section header */}
      <div className="flex items-center gap-2 border-b border-dash-border px-4 py-3">
        <FolderOpen className="size-3.5 text-zinc-500" />
        <h3 className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          Classpath
        </h3>
        <span className="ml-auto font-mono text-[10px] text-zinc-600">
          {classpath.length} entries
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
            placeholder="Search JARs..."
            className="h-8 w-full rounded-md border border-dash-border bg-dash-surface pl-9 pr-3 text-xs text-zinc-200 placeholder:text-zinc-600 focus:border-fr-purple focus:outline-none"
          />
          {(search || activeTag) && (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] tabular-nums text-zinc-600">
              {filtered.length} / {classpath.length}
            </span>
          )}
        </div>
      </div>

      {/* Classpath table */}
      <div ref={tableRef}>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border">
              <th className="px-4 py-2 text-left font-medium text-zinc-500">
                Filename
              </th>
              <th className="hidden px-4 py-2 text-left font-medium text-zinc-500 md:table-cell">
                Path
              </th>
              <th className="px-4 py-2 text-right font-medium text-zinc-500">
                Size
              </th>
              <th className="px-4 py-2 text-left font-medium text-zinc-500">
                Tag
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((entry) => (
              <tr
                key={entry.path}
                className="border-b border-dash-border/50 even:bg-dash-panel transition-colors hover:bg-dash-hover"
              >
                <td className="px-4 py-1.5 font-mono text-zinc-300">
                  {entry.filename}
                </td>
                <td className="hidden px-4 py-1.5 font-mono text-zinc-500 md:table-cell">
                  {entry.path}
                </td>
                <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                  {formatSize(entry.size)}
                </td>
                <td className="px-4 py-1.5">
                  <TagBadge tag={entry.tag} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-zinc-500">
            No matching classpath entries
          </div>
        )}
      </div>
    </div>
  );
}
