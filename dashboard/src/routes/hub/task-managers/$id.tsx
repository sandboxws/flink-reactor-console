/**
 * Hub task manager detail — /hub/task-managers/$id.
 *
 * Tab strip and Overview content match legacy `/task-managers/$id` parity:
 * 7 tabs (Overview / Metrics / Logs / StdOut / Log List / Thread Dump / Profiler).
 * Overview composites the 8/4 top split (memory bar + properties rail) with
 * three full-width sections below: Memory model, Advanced JVM stats, Resources.
 *
 * See `update-hub-tm-detail-overview` (specs repo) for the full design.
 */

import type {
  FlinkJob,
  LogFileEntry,
  TaskManager,
  ThreadDumpInfo,
} from "@flink-reactor/ui"
import {
  HubBreadcrumb,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import {
  Activity,
  AlertTriangle,
  Cpu,
  FileText,
  HardDrive,
  LineChart,
  RotateCcw,
  ScrollText,
  Server,
  Terminal,
  TerminalSquare,
  X,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { TmLogListTabHub } from "@/components/hub/task-managers/tm-log-list-tab-hub"
import { TmOverviewTabHub } from "@/components/hub/task-managers/tm-overview-tab-hub"
import { ProfilerPicker } from "@/components/hub/tools/flamegraph/profiler-picker"
import { TmLogsTab } from "@/components/task-managers/tm-logs-tab"
import { TmMetricsTab } from "@/components/task-managers/tm-metrics-tab"
import { TmStdoutTab } from "@/components/task-managers/tm-stdout-tab"
import { TmThreadDumpTab } from "@/components/task-managers/tm-thread-dump-tab"
import {
  fetchTaskManagerLog,
  fetchTaskManagerLogs,
  fetchTaskManagerStdout,
  fetchTaskManagerThreadDump,
} from "@/lib/graphql-api-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d ${hours % 24}h`
}

/** Color the heap-pressure pill: rose at ≥90%, amber at ≥75%, sage otherwise. */
function heapTone(pct: number): "running" | "warning" | "failed" {
  if (pct >= 90) return "failed"
  if (pct >= 75) return "warning"
  return "running"
}

function HubTaskManagerDetail() {
  const { id } = useParams({ from: "/hub/task-managers/$id" })
  const fetchTm = useClusterStore((s) => s.fetchTaskManagerDetail)
  const clearTm = useClusterStore((s) => s.clearTaskManagerDetail)
  const tm = useClusterStore((s) => s.taskManagerDetail)
  const tmLoading = useClusterStore((s) => s.taskManagerDetailLoading)
  const tmError = useClusterStore((s) => s.taskManagerDetailError)
  const runningJobs = useClusterStore((s) => s.runningJobs)

  const [activeTab, setActiveTab] = useState("overview")
  const [selectedLog, setSelectedLog] = useState<string | null>(null)

  useEffect(() => {
    fetchTm(id)
    setSelectedLog(null)
    return () => clearTm()
  }, [id, fetchTm, clearTm])

  if (tmLoading && !tm) {
    return (
      <HubAppShell>
        <div className="flex h-64 items-center justify-center text-[12px] font-mono text-fg-muted">
          Loading task manager…
        </div>
      </HubAppShell>
    )
  }

  if (tmError || !tm) {
    return (
      <HubAppShell>
        <HubBreadcrumb
          crumbs={[
            { label: "Cluster" },
            { label: "Task managers", to: "/hub/task-managers" },
            { label: id, mono: true },
          ]}
          LinkComponent={HubLink}
        />
        <div className="mt-6 glass-card-static p-6 text-center">
          <AlertTriangle className="mx-auto size-6 text-fr-rose" />
          <h2 className="mt-3 text-[14px] font-medium text-zinc-100">
            {tmError ? "Failed to load task manager" : "Task manager not found"}
          </h2>
          <p className="mt-1 text-[12px] text-fg-muted">
            {tmError ?? `No task manager with ID ${id}.`}
          </p>
        </div>
      </HubAppShell>
    )
  }

  return (
    <HubTmContent
      tm={tm}
      runningJobs={runningJobs}
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      selectedLog={selectedLog}
      setSelectedLog={setSelectedLog}
    />
  )
}

function HubTmContent({
  tm,
  runningJobs,
  activeTab,
  setActiveTab,
  selectedLog,
  setSelectedLog,
}: {
  tm: TaskManager
  runningJobs: FlinkJob[]
  activeTab: string
  setActiveTab: (v: string) => void
  selectedLog: string | null
  setSelectedLog: (v: string | null) => void
}) {
  const heapPct =
    tm.metrics.heapMax === 0
      ? 0
      : Math.round((tm.metrics.heapUsed / tm.metrics.heapMax) * 100)
  const tone = heapTone(heapPct)
  const shortId = tm.id.length > 24 ? `${tm.id.slice(0, 24)}…` : tm.id

  return (
    <HubAppShell>
      {/* ── Breadcrumb ─────────────────────────────────────────── */}
      <HubBreadcrumb
        crumbs={[
          { label: "Cluster" },
          { label: "Task managers", to: "/hub/task-managers" },
          { label: shortId, mono: true },
        ]}
        LinkComponent={HubLink}
      />

      {/* ── Page header ────────────────────────────────────────── */}
      <div className="mt-2 mb-6 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Server
              className={
                tone === "failed"
                  ? "size-6 text-fr-rose shrink-0"
                  : tone === "warning"
                    ? "size-6 text-fr-amber shrink-0"
                    : "size-6 text-fr-sage shrink-0"
              }
            />
            <h1 className="font-sans text-[26px] font-semibold tracking-tight text-zinc-100 truncate">
              {shortId}
            </h1>
            {tone !== "running" ? (
              <span className={`status-pill ${tone} shrink-0`}>
                <AlertTriangle className="size-3" />
                Heap {heapPct}%
              </span>
            ) : (
              <span className="status-pill running shrink-0">
                Heap {heapPct}%
              </span>
            )}
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-fg-muted">
            <span className="font-mono">{tm.path || tm.id}</span>
            <span className="text-fg-faint">·</span>
            <span>port {tm.dataPort}</span>
            <span className="text-fg-faint">·</span>
            <span>last heartbeat {timeAgo(tm.lastHeartbeat)} ago</span>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            disabled
            aria-label="SSH (not implemented)"
          >
            <Terminal />
            SSH
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled
            aria-label="Restart (not implemented)"
          >
            <RotateCcw />
            Restart
          </button>
          <button
            type="button"
            className="btn btn-danger btn-sm"
            disabled
            aria-label="Drain (not implemented)"
          >
            <X />
            Drain
          </button>
        </div>
      </div>

      {/* ── Tabs ───────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-2 flex flex-col"
      >
        <TabsList className="flex w-full items-center gap-1 border-b border-dash-border overflow-x-auto -mb-px bg-transparent p-0">
          <TabsTrigger value="overview" className="tab">
            <HardDrive />
            <span>Overview</span>
          </TabsTrigger>
          <TabsTrigger value="metrics" className="tab">
            <LineChart />
            <span>Metrics</span>
          </TabsTrigger>
          <TabsTrigger value="logs" className="tab">
            <ScrollText />
            <span>Logs</span>
          </TabsTrigger>
          <TabsTrigger value="stdout" className="tab">
            <TerminalSquare />
            <span>StdOut</span>
          </TabsTrigger>
          <TabsTrigger value="log-list" className="tab">
            <FileText />
            <span>Log List</span>
          </TabsTrigger>
          <TabsTrigger value="thread-dump" className="tab">
            <Cpu />
            <span>Thread Dump</span>
          </TabsTrigger>
          <TabsTrigger value="profiler" className="tab">
            <Activity />
            <span>Profiler</span>
          </TabsTrigger>
        </TabsList>

        {/* Overview tab — Hub layout with full legacy content parity */}
        <TabsContent value="overview" className="mt-6 outline-none">
          <TmOverviewTabHub
            tm={tm}
            runningJobs={runningJobs}
            heapPct={heapPct}
          />
        </TabsContent>

        {/* Lazy-loaded tabs — wrap the legacy components */}
        <TabsContent value="metrics" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <TmMetricsTab tm={tm} />
          </div>
        </TabsContent>

        <TabsContent value="logs" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <LazyTextTab
              fetcher={() => fetchTaskManagerLog(tm.id)}
              empty="No log output."
              renderer={(text) => <TmLogsTab logs={text} />}
            />
          </div>
        </TabsContent>

        <TabsContent value="stdout" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <LazyTextTab
              fetcher={() => fetchTaskManagerStdout(tm.id)}
              empty="No stdout output."
              renderer={(text) => <TmStdoutTab stdout={text} />}
            />
          </div>
        </TabsContent>

        <TabsContent value="log-list" className="mt-6 outline-none">
          <LazyLogFilesTab
            tmId={tm.id}
            selectedLog={selectedLog}
            onSelectLog={setSelectedLog}
          />
        </TabsContent>

        <TabsContent value="thread-dump" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <LazyThreadDumpTab tmId={tm.id} />
          </div>
        </TabsContent>

        <TabsContent value="profiler" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <ProfilerPicker
              vertexFilter={(vid) => {
                const ids = new Set(
                  tm.allocatedSlots
                    .map((s) => (s as { vertexId?: string }).vertexId)
                    .filter((v): v is string => typeof v === "string"),
                )
                return ids.size === 0 ? true : ids.has(vid)
              }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </HubAppShell>
  )
}

// ---------------------------------------------------------------------------
// Lazy-loading tab wrappers
// ---------------------------------------------------------------------------

/** Lazy-loads a text-tab fetch on first activation. */
function LazyTextTab({
  fetcher,
  renderer,
  empty,
}: {
  fetcher: () => Promise<string>
  renderer: (text: string) => React.ReactElement
  empty: string
}) {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setText(await fetcher())
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load")
      setText("")
    }
  }, [fetcher])

  useEffect(() => {
    load()
  }, [load])

  if (text === null) {
    return <p className="text-[12px] font-mono text-fg-muted">Loading…</p>
  }
  if (error) {
    return <p className="text-[12px] text-fr-rose">{error}</p>
  }
  if (text === "") {
    return <p className="text-[12px] text-fg-muted">{empty}</p>
  }
  return renderer(text)
}

function LazyThreadDumpTab({ tmId }: { tmId: string }) {
  const [dump, setDump] = useState<ThreadDumpInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchTaskManagerThreadDump(tmId)
      .then((d) => {
        if (!cancelled) {
          setDump(d)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load")
          setDump({ threadInfos: [] })
        }
      })
    return () => {
      cancelled = true
    }
  }, [tmId])

  if (dump === null) {
    return <p className="text-[12px] font-mono text-fg-muted">Loading…</p>
  }
  if (error) {
    return <p className="text-[12px] text-fr-rose">{error}</p>
  }
  return <TmThreadDumpTab threadDump={dump} />
}

function LazyLogFilesTab({
  tmId,
  selectedLog,
  onSelectLog,
}: {
  tmId: string
  selectedLog: string | null
  onSelectLog: (v: string | null) => void
}) {
  const [files, setFiles] = useState<LogFileEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchTaskManagerLogs(tmId)
      .then((list) => {
        if (!cancelled) {
          setFiles(list)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load")
          setFiles([])
        }
      })
    return () => {
      cancelled = true
    }
  }, [tmId])

  if (files === null) {
    return <p className="text-[12px] font-mono text-fg-muted">Loading…</p>
  }
  if (error) {
    return <p className="text-[12px] text-fr-rose">{error}</p>
  }
  return (
    <TmLogListTabHub
      logFiles={files}
      selectedLog={selectedLog}
      onSelectLog={onSelectLog}
      tmId={tmId}
    />
  )
}

export const Route = createFileRoute("/hub/task-managers/$id")({
  component: HubTaskManagerDetail,
})
