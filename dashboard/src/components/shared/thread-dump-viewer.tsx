"use client";

import { useCallback, useMemo, useState } from "react";
import {
  Check,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Lock,
  Search,
  Cpu,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type { ThreadDumpEntry, ThreadState } from "@/data/cluster-types";

// ---------------------------------------------------------------------------
// Thread state → color mapping (Tokyo Night palette via CSS vars)
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<
  ThreadState,
  { text: string; bg: string; border: string; bar: string }
> = {
  RUNNABLE: {
    text: "text-job-running",
    bg: "bg-job-running/10",
    border: "border-job-running/30",
    bar: "bg-job-running",
  },
  WAITING: {
    text: "text-log-warn",
    bg: "bg-log-warn/10",
    border: "border-log-warn/30",
    bar: "bg-log-warn",
  },
  TIMED_WAITING: {
    text: "text-log-debug",
    bg: "bg-log-debug/10",
    border: "border-log-debug/30",
    bar: "bg-log-debug",
  },
  BLOCKED: {
    text: "text-log-error",
    bg: "bg-log-error/10",
    border: "border-log-error/30",
    bar: "bg-log-error",
  },
  NEW: {
    text: "text-zinc-500",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    bar: "bg-zinc-500",
  },
  TERMINATED: {
    text: "text-zinc-500",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/30",
    bar: "bg-zinc-600",
  },
};

const STATE_ORDER: ThreadState[] = [
  "RUNNABLE",
  "WAITING",
  "TIMED_WAITING",
  "BLOCKED",
  "NEW",
  "TERMINATED",
];

// ---------------------------------------------------------------------------
// Frame classification
// ---------------------------------------------------------------------------

const FRAMEWORK_PREFIXES = [
  "java.",
  "javax.",
  "sun.",
  "jdk.",
  "scala.",
  "org.apache.pekko.",
  "akka.",
  "io.netty.",
];

function isFrameworkFrame(frame: string): boolean {
  const match = frame.match(/^at\s+(?:[\w.]+\/\/)?([\w.$]+)/);
  if (!match) return false;
  return FRAMEWORK_PREFIXES.some((prefix) => match[1].startsWith(prefix));
}

function isLockAnnotation(frame: string): "waiting" | "locked" | null {
  if (frame.startsWith("-  waiting on") || frame.startsWith("- waiting on"))
    return "waiting";
  if (frame.startsWith("-  locked") || frame.startsWith("- locked"))
    return "locked";
  return null;
}

// ---------------------------------------------------------------------------
// State distribution bar
// ---------------------------------------------------------------------------

function StateDistributionBar({
  counts,
  total,
}: {
  counts: Record<string, number>;
  total: number;
}) {
  if (total === 0) return null;

  const segments = STATE_ORDER.filter((s) => (counts[s] || 0) > 0).map(
    (state) => ({
      state,
      count: counts[state] || 0,
      pct: ((counts[state] || 0) / total) * 100,
    }),
  );

  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-white/5">
      {segments.map(({ state, pct }) => (
        <div
          key={state}
          className={cn("h-full transition-all", STATE_COLORS[state].bar)}
          style={{ width: `${pct}%` }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary bar
// ---------------------------------------------------------------------------

function StateBadge({
  state,
  count,
  active,
  onClick,
}: {
  state: ThreadState;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  if (count === 0) return null;
  const colors = STATE_COLORS[state];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all",
        active
          ? `${colors.bg} ${colors.border} ${colors.text}`
          : "border-transparent bg-white/5 text-zinc-500 hover:bg-white/8 hover:text-zinc-400",
      )}
    >
      <span>{state.replace("_", " ")}</span>
      <span
        className={cn(
          "rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
          active ? "bg-white/10" : "bg-white/5",
        )}
      >
        {count}
      </span>
    </button>
  );
}

function SummaryBar({
  threads,
  filteredCount,
  activeFilter,
  onFilterChange,
  searchQuery,
  onSearchChange,
  allExpanded,
  onToggleExpandAll,
  onCopyAll,
  onRefresh,
}: {
  threads: ThreadDumpEntry[];
  filteredCount: number;
  activeFilter: ThreadState | null;
  onFilterChange: (state: ThreadState | null) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  allExpanded: boolean;
  onToggleExpandAll: () => void;
  onCopyAll?: () => void;
  onRefresh?: () => void;
}) {
  const [copiedAll, setCopiedAll] = useState(false);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const t of threads) {
      c[t.state] = (c[t.state] || 0) + 1;
    }
    return c;
  }, [threads]);

  const isFiltered = activeFilter !== null || searchQuery.trim() !== "";

  function handleCopyAll() {
    onCopyAll?.();
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: Total + state badges + actions */}
      <div className="flex items-center gap-2">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <span className="text-sm font-medium text-zinc-300">
            {isFiltered ? (
              <>
                <span className="tabular-nums">{filteredCount}</span>
                <span className="text-zinc-600">
                  {" "}
                  / {threads.length}
                </span>
              </>
            ) : (
              threads.length
            )}{" "}
            threads
          </span>
          <span className="text-zinc-700">|</span>
          {STATE_ORDER.map((state) => (
            <StateBadge
              key={state}
              state={state}
              count={counts[state] || 0}
              active={activeFilter === state}
              onClick={() =>
                onFilterChange(activeFilter === state ? null : state)
              }
            />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggleExpandAll}
            className="rounded p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
            title={allExpanded ? "Collapse all" : "Expand all"}
          >
            {allExpanded ? (
              <ChevronsDownUp className="size-3.5" />
            ) : (
              <ChevronsUpDown className="size-3.5" />
            )}
          </button>
          {onCopyAll && (
            <button
              type="button"
              onClick={handleCopyAll}
              className="rounded p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
              title="Copy all thread dumps"
            >
              {copiedAll ? (
                <Check className="size-3.5" />
              ) : (
                <Copy className="size-3.5" />
              )}
            </button>
          )}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="rounded p-1.5 text-zinc-600 transition-colors hover:bg-white/5 hover:text-zinc-400"
              title="Refresh thread dump"
            >
              <RefreshCw className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Row 2: Distribution bar */}
      <StateDistributionBar counts={counts} total={threads.length} />

      {/* Row 3: Search */}
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-zinc-600" />
        <input
          type="text"
          placeholder="Filter by thread name..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full rounded-md border border-dash-border bg-white/3 py-1.5 pl-8 pr-3 text-xs text-zinc-300 placeholder:text-zinc-600 focus:border-zinc-600 focus:outline-none"
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread card — glass-card per thread
// ---------------------------------------------------------------------------

function ThreadFrameList({ frames }: { frames: string[] }) {
  return (
    <div className="space-y-0 font-mono text-[11px] leading-relaxed">
      {frames.map((frame, i) => {
        const lockType = isLockAnnotation(frame);
        if (lockType === "waiting") {
          return (
            <div key={i} className="text-log-warn/80">
              {frame}
            </div>
          );
        }
        if (lockType === "locked") {
          return (
            <div key={i} className="text-log-info/80">
              {frame}
            </div>
          );
        }
        const fw = isFrameworkFrame(frame);
        return (
          <div
            key={i}
            className={cn(fw ? "text-zinc-600" : "font-medium text-zinc-300")}
          >
            {frame}
          </div>
        );
      })}
    </div>
  );
}

function ThreadCard({
  thread,
  expanded,
  onToggle,
}: {
  thread: ThreadDumpEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const colors = STATE_COLORS[thread.state];
  const hasFrames =
    thread.stackFrames.length > 0 || thread.lockedSynchronizers.length > 0;

  function handleCopy() {
    const lines = [
      `"${thread.name}" Id=${thread.id} ${thread.state}${thread.isNative ? " (in native)" : ""}${thread.lockObject ? ` on ${thread.lockObject}` : ""}`,
      ...thread.stackFrames.map((f) => `\t${f}`),
    ];
    if (thread.lockedSynchronizers.length > 0) {
      lines.push("");
      lines.push(
        `\tNumber of locked synchronizers = ${thread.lockedSynchronizers.length}`,
      );
      for (const sync of thread.lockedSynchronizers) {
        lines.push(`\t- ${sync}`);
      }
    }
    navigator.clipboard.writeText(lines.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div
      className={cn(
        "glass-card overflow-hidden transition-all",
        expanded && "border-l-2",
        expanded && colors.border.replace("/30", "/50"),
      )}
    >
      {/* Card header */}
      <div className="group/card relative flex items-start gap-3 p-3">
        {/* Expand trigger */}
        {hasFrames ? (
          <button
            type="button"
            onClick={onToggle}
            className="mt-0.5 shrink-0 text-zinc-600 transition-colors hover:text-zinc-400"
          >
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
        ) : (
          <div className="mt-0.5 w-3.5 shrink-0" />
        )}

        {/* Thread info */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {/* Thread name */}
            <span className="font-mono text-xs font-medium text-zinc-400 break-all">
              {thread.name}
            </span>

            {/* State badge */}
            <span
              className={cn(
                "inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold",
                colors.bg,
                colors.border,
                colors.text,
              )}
            >
              {thread.state.replace("_", " ")}
            </span>

            {/* ID */}
            <span className="text-[10px] tabular-nums text-zinc-600">
              Id={thread.id}
            </span>

            {/* Native badge */}
            {thread.isNative && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-zinc-700/50 bg-zinc-800/50 px-1.5 py-0.5 text-[10px] text-zinc-500">
                <Cpu className="size-2.5" />
                native
              </span>
            )}

            {/* Lock icon */}
            {thread.lockedSynchronizers.length > 0 && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-log-info/20 bg-log-info/5 px-1.5 py-0.5 text-[10px] text-log-info/80">
                <Lock className="size-2.5" />
                {thread.lockedSynchronizers.length}
              </span>
            )}

            {/* Frame count */}
            {thread.stackFrames.length > 0 && (
              <span className="text-[10px] tabular-nums text-zinc-600">
                {thread.stackFrames.length} frames
              </span>
            )}
          </div>

          {/* Lock object */}
          {thread.lockObject && (
            <div className="mt-1 font-mono text-[10px] text-log-warn/60 truncate">
              on {thread.lockObject}
            </div>
          )}
        </div>

        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="shrink-0 rounded p-1 text-zinc-600 opacity-0 transition-all hover:text-zinc-300 group-hover/card:opacity-100"
          title="Copy thread dump"
        >
          {copied ? (
            <Check className="size-3" />
          ) : (
            <Copy className="size-3" />
          )}
        </button>
      </div>

      {/* Collapsible frames */}
      {hasFrames && expanded && (
        <div className="border-t border-white/5 bg-black/20 px-4 py-3">
          <ThreadFrameList frames={thread.stackFrames} />

          {/* Locked synchronizers */}
          {thread.lockedSynchronizers.length > 0 && (
            <div className="mt-3 border-t border-white/5 pt-2">
              <div className="text-[10px] font-medium uppercase tracking-wide text-zinc-600 mb-1">
                Locked synchronizers ({thread.lockedSynchronizers.length})
              </div>
              {thread.lockedSynchronizers.map((sync, i) => (
                <div
                  key={i}
                  className="font-mono text-[11px] text-log-info/70"
                >
                  {sync}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function ThreadDumpViewer({
  threads,
  className,
  onCopyAll,
  onRefresh,
}: {
  threads: ThreadDumpEntry[];
  className?: string;
  onCopyAll?: () => void;
  onRefresh?: () => void;
}) {
  const [activeFilter, setActiveFilter] = useState<ThreadState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    let result = threads;
    if (activeFilter) {
      result = result.filter((t) => t.state === activeFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((t) => t.name.toLowerCase().includes(q));
    }
    return result;
  }, [threads, activeFilter, searchQuery]);

  const threadKey = useCallback(
    (t: ThreadDumpEntry) => `${t.name}-${t.id}`,
    [],
  );

  // Check if all filtered threads with frames are expanded
  const expandableFiltered = useMemo(
    () =>
      filtered.filter(
        (t) => t.stackFrames.length > 0 || t.lockedSynchronizers.length > 0,
      ),
    [filtered],
  );

  const allExpanded =
    expandableFiltered.length > 0 &&
    expandableFiltered.every((t) => expandedIds.has(threadKey(t)));

  function handleToggleExpandAll() {
    if (allExpanded) {
      setExpandedIds(new Set());
    } else {
      setExpandedIds(new Set(expandableFiltered.map(threadKey)));
    }
  }

  function handleToggle(thread: ThreadDumpEntry) {
    const key = threadKey(thread);
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <SummaryBar
        threads={threads}
        filteredCount={filtered.length}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        allExpanded={allExpanded}
        onToggleExpandAll={handleToggleExpandAll}
        onCopyAll={onCopyAll}
        onRefresh={onRefresh}
      />

      {/* Thread list */}
      <div className="flex flex-col gap-2">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-600">
            No threads match the current filter
          </div>
        ) : (
          filtered.map((thread) => (
            <ThreadCard
              key={threadKey(thread)}
              thread={thread}
              expanded={expandedIds.has(threadKey(thread))}
              onToggle={() => handleToggle(thread)}
            />
          ))
        )}
      </div>
    </div>
  );
}
