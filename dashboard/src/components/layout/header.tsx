import { Popover, PopoverContent, PopoverTrigger } from "@flink-reactor/ui"
import { useLocation } from "@tanstack/react-router"
import { Check, Moon, Paintbrush, RefreshCw, Sun } from "lucide-react"
import { cn } from "@/lib/cn"
import { TIMESTAMP_FORMATS } from "@/lib/constants"
import { useClusterStore } from "@/stores/cluster-store"
import { useLogStore } from "@/stores/log-store"
import type { Palette } from "@/stores/ui-store"
import { useUiStore } from "@/stores/ui-store"

const FORMAT_CYCLE: (keyof typeof TIMESTAMP_FORMATS)[] = [
  "time",
  "full",
  "short",
]

type Crumb = { key: string; label: string }

function breadcrumbFromPath(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean)
  let path = ""
  return segments.map((s) => {
    path += `/${s}`
    const label = s
      .split("-")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ")
    return { key: path, label }
  })
}

const LOG_PATHS = ["/logs", "/errors"]
const CLUSTER_PATHS = ["/overview", "/jobs", "/task-managers", "/job-manager"]

function isLogPage(pathname: string): boolean {
  return LOG_PATHS.some((p) => pathname.startsWith(p))
}

function isClusterPage(pathname: string): boolean {
  return CLUSTER_PATHS.some((p) => pathname.startsWith(p))
}

function LogHeaderRight() {
  const isStreaming = useLogStore((s) => s.isStreaming)
  const entryCount = useLogStore((s) => s.entries.length)
  const timestampFormat = useUiStore((s) => s.timestampFormat)
  const setTimestampFormat = useUiStore((s) => s.setTimestampFormat)

  function cycleFormat() {
    const idx = FORMAT_CYCLE.indexOf(timestampFormat)
    const next = FORMAT_CYCLE[(idx + 1) % FORMAT_CYCLE.length]
    setTimestampFormat(next)
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
  )
}

function ClusterHeaderRight() {
  const lastUpdated = useClusterStore((s) => s.lastUpdated)
  const refresh = useClusterStore((s) => s.refresh)
  const isPolling = useClusterStore((s) => s.isPolling)

  const secondsAgo = lastUpdated
    ? Math.max(0, Math.round((Date.now() - lastUpdated.getTime()) / 1000))
    : null

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
  )
}

const PALETTES: {
  id: Palette
  label: string
  swatches: string[]
}[] = [
  {
    id: "gruvpuccin",
    label: "Gruvpuccin",
    swatches: ["#e78a4e", "#a9b665", "#7daea3", "#d8a657"],
  },
  {
    id: "tokyo-night",
    label: "Tokyo Night",
    swatches: ["#d97085", "#9b6bbf", "#7aa2f7", "#73daca"],
  },
]

function ThemeSwitcher() {
  const theme = useUiStore((s) => s.theme)
  const palette = useUiStore((s) => s.palette)
  const toggleTheme = useUiStore((s) => s.toggleTheme)
  const setPalette = useUiStore((s) => s.setPalette)

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="rounded p-1 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300"
          title="Theme"
        >
          <Paintbrush className="size-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={6} className="w-52 p-0">
        {/* Palette picker */}
        <div className="border-b border-dash-border px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Palette
          </span>
        </div>
        <div className="flex flex-col">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPalette(p.id)}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors hover:bg-white/[0.06]",
                palette === p.id ? "text-zinc-200" : "text-zinc-400",
              )}
            >
              <div className="flex gap-1">
                {p.swatches.map((color) => (
                  <div
                    key={color}
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <span className="flex-1">{p.label}</span>
              {palette === p.id && <Check className="size-3 text-zinc-400" />}
            </button>
          ))}
        </div>

        {/* Mode toggle */}
        <div className="border-t border-dash-border px-3 py-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
            Mode
          </span>
        </div>
        <div className="flex items-center gap-2 px-3 pb-2.5">
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
              theme === "dark"
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-400 hover:bg-white/[0.06]",
            )}
            title="Dark mode"
          >
            <Moon className="size-3" />
            Dark
          </button>
          <button
            type="button"
            onClick={toggleTheme}
            className={cn(
              "flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-colors",
              theme === "light"
                ? "bg-white/[0.08] text-zinc-200"
                : "text-zinc-400 hover:bg-white/[0.06]",
            )}
            title="Light mode"
          >
            <Sun className="size-3" />
            Light
          </button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

export function Header() {
  const pathname = useLocation({ select: (l) => l.pathname })
  const crumbs = breadcrumbFromPath(pathname)

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

      {/* Right: context-aware controls + theme toggle */}
      <div className="flex items-center gap-3 text-xs">
        {isLogPage(pathname) && <LogHeaderRight />}
        {isClusterPage(pathname) && <ClusterHeaderRight />}
        <ThemeSwitcher />
      </div>
    </header>
  )
}
