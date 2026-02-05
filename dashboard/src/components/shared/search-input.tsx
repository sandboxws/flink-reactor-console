"use client";

import { ChevronDown, ChevronUp, Regex, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { useSearchMatches } from "@/lib/hooks";
import { useFilterStore } from "@/stores/filter-store";

export function SearchInput() {
  const searchQuery = useFilterStore((s) => s.searchQuery);
  const setSearchQuery = useFilterStore((s) => s.setSearchQuery);
  const isRegex = useFilterStore((s) => s.isRegex);
  const setIsRegex = useFilterStore((s) => s.setIsRegex);

  const { matchCount, currentIndex, next, prev } = useSearchMatches();

  return (
    <div className="flex items-center gap-1 rounded-md border border-dash-border bg-dash-surface px-2 py-1">
      <Search className="size-3.5 shrink-0 text-zinc-500" />
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.shiftKey ? prev() : next();
          }
        }}
        placeholder="Search logs..."
        className="w-40 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
      />

      {/* Regex toggle */}
      <button
        type="button"
        onClick={() => setIsRegex(!isRegex)}
        className={cn(
          "rounded p-0.5 transition-colors",
          isRegex
            ? "bg-fr-purple/20 text-fr-purple"
            : "text-zinc-500 hover:text-zinc-300",
        )}
        title="Toggle regex mode"
      >
        <Regex className="size-3" />
      </button>

      {/* Match count and navigation */}
      {searchQuery && (
        <>
          <span className="text-[10px] text-zinc-500">
            {matchCount > 0 ? `${currentIndex + 1}/${matchCount}` : "0/0"}
          </span>
          <button
            type="button"
            onClick={prev}
            disabled={matchCount === 0}
            className="text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-30"
          >
            <ChevronUp className="size-3" />
          </button>
          <button
            type="button"
            onClick={next}
            disabled={matchCount === 0}
            className="text-zinc-500 transition-colors hover:text-zinc-300 disabled:opacity-30"
          >
            <ChevronDown className="size-3" />
          </button>
          <button
            type="button"
            onClick={() => setSearchQuery("")}
            className="text-zinc-500 transition-colors hover:text-zinc-300"
          >
            <X className="size-3" />
          </button>
        </>
      )}
    </div>
  );
}
