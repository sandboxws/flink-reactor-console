/**
 * @module async-profiler-panel
 *
 * The async-profiler surface shared by the JobManager and TaskManager profiler
 * tabs (and the Hub profiler tools). It drives Flink's built-in JVM async
 * profiler (FLIP-375): pick an event mode + duration, trigger a run, poll it to
 * completion, and open the resulting flame graph in a new tab.
 *
 * This is intentionally distinct from the operator flame graph. The copy and
 * mode selector here make clear the async profiler samples the whole JVM — CPU,
 * allocation pressure, lock contention, or wall-clock — not one operator's
 * on/off-CPU stacks.
 *
 * When the cluster does not advertise the `ASYNC_PROFILER` capability (pre-1.19
 * or `rest.profiling.enabled` unset), the panel renders a disabled state
 * explaining the requirement and never attempts a trigger.
 */

import { EmptyState, Spinner } from "@flink-reactor/ui"
import { Activity, Download, TriangleAlert } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/cn"
import {
  absoluteProfilerDownloadUrl,
  type ProfilerInstance,
  type ProfilerMode,
  pollProfilerInstance,
} from "@/lib/profiler-data"

/** Event modes with human labels, ordered most-useful-first. */
const MODES: { value: ProfilerMode; label: string; hint: string }[] = [
  {
    value: "ITIMER",
    label: "ITIMER",
    hint: "Wall+CPU sampler that works without perf_events (safe default)",
  },
  {
    value: "CPU",
    label: "CPU",
    hint: "On-CPU sampling via perf_events (may be restricted in containers)",
  },
  {
    value: "ALLOC",
    label: "Allocation",
    hint: "Heap allocation pressure — attributes GC churn",
  },
  {
    value: "LOCK",
    label: "Lock contention",
    hint: "Monitor/lock contention hotspots",
  },
  {
    value: "WALL",
    label: "Wall-clock",
    hint: "Wall-clock time including off-CPU waits",
  },
]

const DEFAULT_DURATION = 30
const MIN_DURATION = 5
const MAX_DURATION = 300

interface AsyncProfilerPanelProps {
  /** Short label for the profiled target, e.g. "JobManager" or "TaskManager tm-1". */
  targetLabel: string
  /** True when the cluster advertises the ASYNC_PROFILER capability. */
  enabled: boolean
  /** Trigger a run; resolves with the created (RUNNING) instance. */
  onTrigger: (mode: ProfilerMode, duration: number) => Promise<ProfilerInstance>
  /** List this target's profiler instances (used for polling + history). */
  onList: () => Promise<ProfilerInstance[]>
}

type RunState =
  | { phase: "idle" }
  | { phase: "running"; mode: ProfilerMode }
  | { phase: "done"; instance: ProfilerInstance }
  | { phase: "error"; message: string }

export function AsyncProfilerPanel({
  targetLabel,
  enabled,
  onTrigger,
  onList,
}: AsyncProfilerPanelProps) {
  const [mode, setMode] = useState<ProfilerMode>("ITIMER")
  const [duration, setDuration] = useState<number>(DEFAULT_DURATION)
  const [run, setRun] = useState<RunState>({ phase: "idle" })
  const [history, setHistory] = useState<ProfilerInstance[]>([])
  const abortRef = useRef<AbortController | null>(null)

  const refreshHistory = useCallback(() => {
    onList()
      .then(setHistory)
      .catch(() => {
        /* history is best-effort; ignore */
      })
  }, [onList])

  // Load existing runs on mount (and whenever the target changes).
  useEffect(() => {
    if (!enabled) return
    refreshHistory()
  }, [enabled, refreshHistory])

  // Cancel any in-flight poll on unmount.
  useEffect(() => () => abortRef.current?.abort(), [])

  const running = run.phase === "running"

  const start = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    setRun({ phase: "running", mode })
    try {
      const triggered = await onTrigger(mode, duration)
      refreshHistory()
      const final = await pollProfilerInstance(onList, triggered.id, {
        // Outlast the run itself with headroom for flame-graph rendering.
        timeoutMs: (duration + 60) * 1000,
        signal: controller.signal,
      })
      refreshHistory()
      if (final.status === "FAILED") {
        setRun({
          phase: "error",
          message: final.message || "Profiling run failed",
        })
      } else {
        setRun({ phase: "done", instance: final })
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return
      setRun({
        phase: "error",
        message: e instanceof Error ? e.message : "Profiling failed",
      })
    }
  }, [mode, duration, onTrigger, onList, refreshHistory])

  if (!enabled) {
    return (
      <div className="pt-4">
        <EmptyState
          icon={Activity}
          title="JVM async profiler unavailable"
          description="Requires Flink 1.19+ with rest.profiling.enabled: true. Enable it in the cluster config to profile the JobManager and TaskManagers."
        />
      </div>
    )
  }

  const activeHint = MODES.find((m) => m.value === mode)?.hint

  return (
    <div className="space-y-4 pt-2">
      {/* Explainer — keep the async profiler distinct from the operator flame graph. */}
      <div className="rounded-lg border border-dash-border bg-dash-panel/60 p-3">
        <div className="flex items-center gap-2">
          <Activity className="size-4 text-fr-coral" />
          <h3 className="text-sm font-semibold text-fg">JVM async profiler</h3>
          <span className="rounded bg-dash-elevated px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            FLIP-375
          </span>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-fg-muted">
          Profiles the entire {targetLabel} JVM — CPU, allocation pressure, lock
          contention, or wall-clock — and produces a downloadable flame graph.
          This is separate from the operator flame graph, which samples a single
          operator's on/off-CPU stacks.
        </p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-dash-border bg-dash-panel p-3">
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            Mode
          </span>
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as ProfilerMode)}
            disabled={running}
            className="rounded-md border border-dash-border bg-dash-panel px-2 py-1.5 font-mono text-xs text-fg disabled:opacity-60"
          >
            {MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            Duration (s)
          </span>
          <input
            type="number"
            min={MIN_DURATION}
            max={MAX_DURATION}
            value={duration}
            onChange={(e) => {
              const n = Number(e.target.value)
              if (!Number.isNaN(n)) {
                setDuration(
                  Math.min(MAX_DURATION, Math.max(MIN_DURATION, Math.round(n))),
                )
              }
            }}
            disabled={running}
            className="w-24 rounded-md border border-dash-border bg-dash-panel px-2 py-1.5 font-mono text-xs text-fg disabled:opacity-60"
          />
        </label>

        <button
          type="button"
          onClick={start}
          disabled={running}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
            "bg-fr-coral text-white hover:bg-fr-coral/90",
            "disabled:cursor-not-allowed disabled:opacity-60",
          )}
        >
          {running ? <Spinner size="sm" /> : <Activity className="size-3.5" />}
          {running ? "Profiling…" : "Start profiling"}
        </button>

        {activeHint ? (
          <p className="w-full text-[11px] text-fg-faint">{activeHint}</p>
        ) : null}
      </div>

      {/* Current run result */}
      {run.phase === "running" ? (
        <div className="flex items-center gap-2 rounded-lg border border-dash-border bg-dash-panel p-3 text-xs text-fg-muted">
          <Spinner size="sm" />
          <span>
            Running {run.mode} profile for {duration}s — this pauses until the
            run completes.
          </span>
        </div>
      ) : null}

      {run.phase === "done" ? <FinishedRun instance={run.instance} /> : null}

      {run.phase === "error" ? (
        <div className="flex items-start gap-2 rounded-lg border border-fr-rose/40 bg-fr-rose/10 p-3 text-xs text-fr-rose">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" />
          <span className="font-mono">{run.message}</span>
        </div>
      ) : null}

      {/* Recent runs */}
      {history.length > 0 ? (
        <div className="rounded-lg border border-dash-border bg-dash-panel">
          <div className="border-b border-dash-border px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-fg-faint">
            Recent runs
          </div>
          <ul className="divide-y divide-dash-border">
            {history.map((inst) => (
              <HistoryRow key={inst.id} instance={inst} />
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}

function FinishedRun({ instance }: { instance: ProfilerInstance }) {
  const open = () => {
    if (instance.downloadUrl) {
      window.open(
        absoluteProfilerDownloadUrl(instance.downloadUrl),
        "_blank",
        "noopener,noreferrer",
      )
    }
  }
  return (
    <div className="flex items-center justify-between rounded-lg border border-fr-sage/40 bg-fr-sage/10 p-3">
      <div className="text-xs text-fg">
        <span className="font-semibold">{instance.mode}</span> profile finished
        <span className="ml-1 text-fg-muted">({instance.duration}s)</span>
      </div>
      <button
        type="button"
        onClick={open}
        disabled={!instance.downloadUrl}
        className="inline-flex items-center gap-1.5 rounded-md border border-dash-border bg-dash-elevated px-2.5 py-1.5 text-xs font-medium text-fg hover:bg-dash-panel disabled:opacity-60"
      >
        <Download className="size-3.5" />
        Open flame graph
      </button>
    </div>
  )
}

function HistoryRow({ instance }: { instance: ProfilerInstance }) {
  const open = () => {
    if (instance.downloadUrl) {
      window.open(
        absoluteProfilerDownloadUrl(instance.downloadUrl),
        "_blank",
        "noopener,noreferrer",
      )
    }
  }
  return (
    <li className="flex items-center justify-between px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <StatusDot status={instance.status} />
        <span className="font-mono text-fg">{instance.mode}</span>
        <span className="text-fg-faint">{instance.duration}s</span>
        {instance.status === "FAILED" && instance.message ? (
          <span className="truncate text-fr-rose" title={instance.message}>
            {instance.message}
          </span>
        ) : null}
      </div>
      {instance.status === "FINISHED" && instance.downloadUrl ? (
        <button
          type="button"
          onClick={open}
          className="inline-flex items-center gap-1 text-fr-coral hover:underline"
        >
          <Download className="size-3" />
          Open
        </button>
      ) : null}
    </li>
  )
}

function StatusDot({ status }: { status: ProfilerInstance["status"] }) {
  const color =
    status === "FINISHED"
      ? "bg-fr-sage"
      : status === "FAILED"
        ? "bg-fr-rose"
        : "bg-fr-amber animate-pulse"
  return (
    <span
      role="img"
      className={cn("size-2 shrink-0 rounded-full", color)}
      aria-label={status}
    />
  )
}
