/**
 * @module tap-controls
 *
 * Playback control bar for TAP observation sessions. Provides Play, Resume,
 * Pause, Stop, and Clear buttons whose enabled state follows a strict state
 * matrix based on the current {@link ActiveTapSession} status.
 */

import { Spinner } from "@flink-reactor/ui"
import { Pause, Play, RotateCcw, Square, Trash2 } from "lucide-react"
import { cn } from "@/lib/cn"
import type { ActiveTapSession } from "@/stores/sql-gateway-store"

interface TapControlsProps {
  /** Current session status or "idle" when no session exists. */
  status: ActiveTapSession["status"] | "idle"
  /** Start a new observation session. */
  onPlay: () => void
  /** Resume a paused session. */
  onResume: () => void
  /** Pause result consumption (session stays open). */
  onPause: () => void
  /** Stop the session and close the SQL Gateway connection. */
  onStop: () => void
  /** Clear the buffered row data. */
  onClear: () => void
}

const iconClass = "size-3.5"

/**
 * Button state matrix:
 * | State        | Play | Resume | Pause | Stop |
 * |--------------|------|--------|-------|------|
 * | idle/closed  |  on  |  off   |  off  |  off |
 * | connecting   |  off |  off   |  off  |  on  |
 * | streaming    |  off |  off   |  on   |  on  |
 * | paused       |  off |  on    |  off  |  on  |
 * | error        |  on  |  off   |  off  |  on  |
 */
export function TapControls({
  status,
  onPlay,
  onResume,
  onPause,
  onStop,
  onClear,
}: TapControlsProps) {
  const isIdle = status === "idle" || status === "closed"
  const isConnecting = status === "connecting"
  const isStreaming = status === "streaming"
  const isPaused = status === "paused"
  const isError = status === "error"
  const hasSession = isStreaming || isPaused || isConnecting

  const playEnabled = isIdle || isError
  const resumeEnabled = isPaused
  const pauseEnabled = isStreaming
  const stopEnabled = hasSession || isError

  return (
    <div className="flex items-center gap-1.5">
      {/* Play (new session) */}
      <button
        type="button"
        onClick={onPlay}
        disabled={!playEnabled}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          playEnabled
            ? "bg-job-running/15 text-job-running hover:bg-job-running/25"
            : "cursor-not-allowed bg-dash-elevated/50 text-zinc-600",
        )}
        title="Start new observation"
      >
        {isConnecting ? (
          <Spinner size="sm" />
        ) : (
          <Play className={iconClass} />
        )}
        {isConnecting ? "Connecting" : "Play"}
      </button>

      {/* Resume (unpause existing session) */}
      <button
        type="button"
        onClick={onResume}
        disabled={!resumeEnabled}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          resumeEnabled
            ? "bg-fr-purple/15 text-fr-purple hover:bg-fr-purple/25"
            : "cursor-not-allowed bg-dash-elevated/50 text-zinc-600",
        )}
        title="Resume paused observation"
      >
        <RotateCcw className={iconClass} />
        Resume
      </button>

      {/* Pause */}
      <button
        type="button"
        onClick={onPause}
        disabled={!pauseEnabled}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          pauseEnabled
            ? "bg-fr-amber/15 text-fr-amber hover:bg-fr-amber/25"
            : "cursor-not-allowed bg-dash-elevated/50 text-zinc-600",
        )}
        title="Pause result consumption"
      >
        <Pause className={iconClass} />
        Pause
      </button>

      {/* Stop */}
      <button
        type="button"
        onClick={onStop}
        disabled={!stopEnabled}
        className={cn(
          "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
          stopEnabled
            ? "bg-job-failed/15 text-job-failed hover:bg-job-failed/25"
            : "cursor-not-allowed bg-dash-elevated/50 text-zinc-600",
        )}
        title="Stop session and keep data"
      >
        <Square className={iconClass} />
        Stop
      </button>

      {/* Clear */}
      <button
        type="button"
        onClick={onClear}
        className="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-dash-hover hover:text-zinc-200"
        title="Clear buffered rows"
      >
        <Trash2 className={iconClass} />
        Clear
      </button>

      {/* Status indicator */}
      <div className="ml-2 flex items-center gap-1.5">
        <StatusDot status={status} />
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          {statusLabel(status)}
        </span>
      </div>
    </div>
  )
}

/** Animated status indicator dot — pulsing green for streaming, spinner for connecting. */
function StatusDot({
  status,
}: {
  status: ActiveTapSession["status"] | "idle"
}) {
  if (status === "streaming") {
    return (
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-job-running opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-job-running" />
      </span>
    )
  }
  if (status === "connecting") {
    return <Spinner size="sm" className="text-fr-purple" />
  }
  if (status === "paused") {
    return <span className="inline-flex size-2 rounded-full bg-fr-amber" />
  }
  if (status === "error") {
    return <span className="inline-flex size-2 rounded-full bg-job-failed" />
  }
  return <span className="inline-flex size-2 rounded-full bg-zinc-600" />
}

/** Maps session status to a human-readable label for the status indicator. */
function statusLabel(status: ActiveTapSession["status"] | "idle"): string {
  switch (status) {
    case "connecting":
      return "Connecting"
    case "streaming":
      return "Streaming"
    case "paused":
      return "Paused"
    case "error":
      return "Error"
    case "closed":
      return "Stopped"
    case "idle":
      return "Ready"
  }
}
