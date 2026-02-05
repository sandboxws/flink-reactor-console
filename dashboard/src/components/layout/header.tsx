"use client";

import { RefreshCw } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import { TIMESTAMP_FORMATS } from "@/lib/constants";
import { useClusterStore } from "@/stores/cluster-store";
import { useLogStore } from "@/stores/log-store";
import { useUiStore } from "@/stores/ui-store";

const FORMAT_CYCLE: (keyof typeof TIMESTAMP_FORMATS)[] = [
  "time",
  "full",
  "short",
];

type Crumb = { key: string; label: string };

function breadcrumbFromPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  let path = "";
  return segments.map((s) => {
    path += `/${s}`;
    const label = s
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
    return { key: path, label };
  });
}

const LOG_PATHS = ["/logs", "/errors"];
const CLUSTER_PATHS = ["/overview", "/jobs", "/task-managers", "/job-manager"];

function isLogPage(pathname: string): boolean {
  return LOG_PATHS.some((p) => pathname.startsWith(p));
}

function isClusterPage(pathname: string): boolean {
  return CLUSTER_PATHS.some((p) => pathname.startsWith(p));
}

function LogHeaderRight() {
  const isStreaming = useLogStore((s) => s.isStreaming);
  const entryCount = useLogStore((s) => s.entries.length);
  const timestampFormat = useUiStore((s) => s.timestampFormat);
  const setTimestampFormat = useUiStore((s) => s.setTimestampFormat);

  function cycleFormat() {
    const idx = FORMAT_CYCLE.indexOf(timestampFormat);
    const next = FORMAT_CYCLE[(idx + 1) % FORMAT_CYCLE.length];
    setTimestampFormat(next);
  }

  return (
    <>
      <span className="text-zinc-500">
        {entryCount.toLocaleString()} entries
      </span>

      <button
        type="button"
        onClick={cycleFormat}
        className="rounded px-1.5 py-0.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
        title={`Format: ${TIMESTAMP_FORMATS[timestampFormat]}`}
      >
        {timestampFormat}
      </button>

      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "size-1.5 rounded-full",
            isStreaming ? "animate-pulse bg-emerald-400" : "bg-zinc-600",
          )}
        />
        <span
          className={cn(isStreaming ? "text-emerald-400" : "text-zinc-500")}
        >
          {isStreaming ? "Live" : "Paused"}
        </span>
      </div>
    </>
  );
}

function ClusterHeaderRight() {
  const lastUpdated = useClusterStore((s) => s.lastUpdated);
  const refresh = useClusterStore((s) => s.refresh);
  const isPolling = useClusterStore((s) => s.isPolling);

  const secondsAgo = lastUpdated
    ? Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))
    : null;

  return (
    <>
      {secondsAgo !== null && (
        <span className="text-zinc-500">Updated {secondsAgo}s ago</span>
      )}

      <button
        type="button"
        onClick={refresh}
        className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
        title="Refresh"
      >
        <RefreshCw className="size-3" />
      </button>

      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "size-1.5 rounded-full",
            isPolling ? "animate-pulse bg-emerald-400" : "bg-zinc-600",
          )}
        />
        <span className={cn(isPolling ? "text-emerald-400" : "text-zinc-500")}>
          {isPolling ? "Polling" : "Paused"}
        </span>
      </div>
    </>
  );
}

export function Header() {
  const pathname = usePathname();
  const crumbs = breadcrumbFromPath(pathname);

  return (
    <header className="flex h-11 shrink-0 items-center justify-between border-b border-dash-border bg-dash-panel px-4">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-1.5 text-xs">
        <span className="text-zinc-500">Dashboard</span>
        {crumbs.map((crumb) => (
          <span key={crumb.key} className="flex items-center gap-1.5">
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-300">{crumb.label}</span>
          </span>
        ))}
      </div>

      {/* Right: context-aware controls */}
      <div className="flex items-center gap-3 text-xs">
        {isLogPage(pathname) && <LogHeaderRight />}
        {isClusterPage(pathname) && <ClusterHeaderRight />}
      </div>
    </header>
  );
}
