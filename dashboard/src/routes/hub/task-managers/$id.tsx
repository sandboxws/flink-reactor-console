/**
 * Hub task manager detail — /hub/task-managers/$id.
 *
 * Mirrors `console-v2/task-manager.html`. The Memory tab is rendered with a
 * Hub-native layout (memory breakdown card on the left + properties / hosted
 * pipelines / active alert rail on the right). Other tabs reuse the legacy
 * `Tm*Tab` components — chrome matches the mockup; tab interiors are deferred
 * to a follow-up styling change (called out in the P2 spec).
 */

import type {
  FlinkJob,
  LogFileEntry,
  TaskManager,
  ThreadDumpInfo,
} from "@flink-reactor/ui"
import {
  formatBytes,
  HubBreadcrumb,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import { createFileRoute, Link, useParams } from "@tanstack/react-router"
import {
  AlertTriangle,
  HardDrive,
  LineChart,
  RotateCcw,
  ScrollText,
  Server,
  SlidersHorizontal,
  Terminal,
  TerminalSquare,
  X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useState } from "react"
import { TmLogsTab } from "@/components/task-managers/tm-logs-tab"
import { TmMetricsTab } from "@/components/task-managers/tm-metrics-tab"
import { TmStdoutTab } from "@/components/task-managers/tm-stdout-tab"
import { TmThreadDumpTab } from "@/components/task-managers/tm-thread-dump-tab"
import {
  fetchTaskManagerLog,
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

  const [activeTab, setActiveTab] = useState("memory")

  useEffect(() => {
    fetchTm(id)
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
    />
  )
}

function HubTmContent({
  tm,
  runningJobs,
  activeTab,
  setActiveTab,
}: {
  tm: TaskManager
  runningJobs: FlinkJob[]
  activeTab: string
  setActiveTab: (v: string) => void
}) {
  const heapPct =
    tm.metrics.heapMax === 0
      ? 0
      : Math.round((tm.metrics.heapUsed / tm.metrics.heapMax) * 100)
  const tone = heapTone(heapPct)
  const shortId = tm.id.length > 24 ? `${tm.id.slice(0, 24)}…` : tm.id

  // Memory percentages relative to physical memory (matches mockup contract).
  const total = Math.max(1, tm.physicalMemory)
  const heapUsed = tm.metrics.heapUsed
  const managedUsed = tm.metrics.managedMemoryUsed
  const networkUsed = tm.metrics.nettyShuffleMemoryUsed
  const directUsed = tm.metrics.directUsed
  const heapPctP = (heapUsed / total) * 100
  const managedPctP = (managedUsed / total) * 100
  const networkPctP = (networkUsed / total) * 100
  const directPctP = (directUsed / total) * 100
  const freePctP = Math.max(
    0,
    100 - heapPctP - managedPctP - networkPctP - directPctP,
  )
  const freeBytes = Math.max(
    0,
    tm.physicalMemory - heapUsed - managedUsed - networkUsed - directUsed,
  )

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
          <TabsTrigger value="memory" className="tab">
            <HardDrive />
            <span>Memory</span>
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
          <TabsTrigger value="threads" className="tab">
            <Terminal />
            <span>Threads</span>
          </TabsTrigger>
          <TabsTrigger value="config" className="tab">
            <SlidersHorizontal />
            <span>Config</span>
          </TabsTrigger>
        </TabsList>

        {/* Memory tab — Hub layout */}
        <TabsContent value="memory" className="mt-6 outline-none">
          <section className="grid grid-cols-12 gap-5">
            <div className="col-span-12 lg:col-span-8">
              <div className="glass-card-static p-5">
                <h3 className="font-sans text-[14px] font-medium text-zinc-100 mb-4">
                  Memory breakdown
                </h3>
                <div className="resource-bar mb-3" style={{ height: 18 }}>
                  <div className="seg heap" style={{ width: `${heapPctP}%` }} />
                  <div
                    className="seg managed"
                    style={{ width: `${managedPctP}%` }}
                  />
                  <div
                    className="seg network"
                    style={{ width: `${networkPctP}%` }}
                  />
                  <div
                    className="seg direct"
                    style={{ width: `${directPctP}%` }}
                  />
                  <div className="seg free" style={{ width: `${freePctP}%` }} />
                </div>
                <div className="grid grid-cols-2 gap-3 text-[12px] md:grid-cols-5">
                  <MemorySegmentLabel
                    label="Heap"
                    used={heapUsed}
                    total={tm.metrics.heapMax}
                    pct={heapPctP}
                    tone={
                      heapPct >= 90 ? "rose" : heapPct >= 75 ? "amber" : "sage"
                    }
                  />
                  <MemorySegmentLabel
                    label="Managed"
                    used={managedUsed}
                    total={tm.metrics.managedMemoryTotal}
                    pct={managedPctP}
                    tone="sage"
                  />
                  <MemorySegmentLabel
                    label="Network"
                    used={networkUsed}
                    total={tm.metrics.nettyShuffleMemoryTotal}
                    pct={networkPctP}
                    tone="sage"
                  />
                  <MemorySegmentLabel
                    label="Direct"
                    used={directUsed}
                    total={tm.metrics.directMax}
                    pct={directPctP}
                    tone="sage"
                  />
                  <div>
                    <div className="text-[10px] text-fg-faint font-mono uppercase">
                      Free
                    </div>
                    <div className="font-mono text-fg-muted">
                      {formatBytes(freeBytes)}
                    </div>
                    <div className="text-[10px] text-fg-faint">
                      {Math.round(freePctP)}%
                    </div>
                  </div>
                </div>

                <h3 className="font-sans text-[14px] font-medium text-zinc-100 mt-6 mb-3">
                  GC activity
                </h3>
                {tm.metrics.garbageCollectors.length > 0 ? (
                  <ul className="space-y-1.5 text-[12px]">
                    {tm.metrics.garbageCollectors.map((gc) => (
                      <li
                        key={gc.name}
                        className="flex items-center justify-between font-mono"
                      >
                        <span className="text-fg">{gc.name}</span>
                        <span className="text-fg-muted">
                          {gc.count} collections · {(gc.time / 1000).toFixed(1)}
                          s total
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-[12px] text-fg-muted">
                    No GC activity reported.
                  </p>
                )}
              </div>
            </div>

            <div className="col-span-12 lg:col-span-4 space-y-4">
              <TmPropertiesCard tm={tm} />
              <HostedPipelinesCard tm={tm} runningJobs={runningJobs} />
              {heapPct >= 75 ? <ActiveAlertCard heapPct={heapPct} /> : null}
            </div>
          </section>
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
              tabId={tm.id}
              fetcher={() => fetchTaskManagerLog(tm.id)}
              empty="No log output."
              renderer={(text) => <TmLogsTab logs={text} />}
            />
          </div>
        </TabsContent>

        <TabsContent value="stdout" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <LazyTextTab
              tabId={tm.id}
              fetcher={() => fetchTaskManagerStdout(tm.id)}
              empty="No stdout output."
              renderer={(text) => <TmStdoutTab stdout={text} />}
            />
          </div>
        </TabsContent>

        <TabsContent value="threads" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <LazyThreadDumpTab tmId={tm.id} />
          </div>
        </TabsContent>

        <TabsContent value="config" className="mt-6 outline-none">
          <div className="glass-card-static p-8 text-center">
            <p className="text-[12px] text-fg-muted">
              TM configuration is exposed in the JobManager Config tab today; a
              dedicated per-TM config view is on the roadmap.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </HubAppShell>
  )
}

function MemorySegmentLabel({
  label,
  used,
  total,
  pct,
  tone,
}: {
  label: string
  used: number
  total: number
  pct: number
  tone: "sage" | "amber" | "rose"
}) {
  const toneClass =
    tone === "rose"
      ? "text-fr-rose"
      : tone === "amber"
        ? "text-fr-amber"
        : "text-fr-sage"
  return (
    <div>
      <div className="text-[10px] text-fg-faint font-mono uppercase">
        {label}
      </div>
      <div className="font-mono text-zinc-100">
        {formatBytes(used)}{" "}
        <span className="text-fg-muted">/{formatBytes(total)}</span>
      </div>
      <div className={`text-[10px] font-mono ${toneClass}`}>
        {Math.round(pct)}% of physical
      </div>
    </div>
  )
}

function TmPropertiesCard({ tm }: { tm: TaskManager }) {
  return (
    <div className="glass-card-static p-5">
      <h3 className="section-heading mb-3">TM properties</h3>
      <dl className="space-y-2 text-[12px]">
        <PropRow
          label="Slots"
          value={`${tm.slotsTotal - tm.slotsFree} / ${tm.slotsTotal}`}
        />
        <PropRow label="Tasks" value={`${tm.slotsTotal - tm.slotsFree}`} />
        <PropRow label="CPU cores" value={`${tm.cpuCores}`} />
        <PropRow label="Physical mem" value={formatBytes(tm.physicalMemory)} />
        <PropRow label="Free mem" value={formatBytes(tm.freeMemory)} />
        <PropRow label="Threads" value={`${tm.metrics.threadCount}`} />
        <PropRow label="Data port" value={`${tm.dataPort}`} />
        <PropRow label="JMX port" value={`${tm.jmxPort}`} />
      </dl>
    </div>
  )
}

function PropRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-fg-muted">{label}</dt>
      <dd className="font-mono text-fg truncate">{value}</dd>
    </div>
  )
}

function HostedPipelinesCard({
  tm,
  runningJobs,
}: {
  tm: TaskManager
  runningJobs: FlinkJob[]
}) {
  const hosted = useMemo(() => {
    const ids = new Set(tm.allocatedSlots.map((s) => s.jobId))
    return runningJobs.filter((j) => ids.has(j.id))
  }, [tm.allocatedSlots, runningJobs])

  return (
    <div className="glass-card-static p-5">
      <h3 className="section-heading mb-3">
        Hosted pipelines ({hosted.length})
      </h3>
      {hosted.length === 0 ? (
        <p className="text-[12px] text-fg-muted">
          No pipelines are currently allocated to this task manager.
        </p>
      ) : (
        <ul className="space-y-1.5 text-[12px]">
          {hosted.map((job) => {
            const slotCount = tm.allocatedSlots.filter(
              (s) => s.jobId === job.id,
            ).length
            return (
              <li key={job.id} className="flex items-center gap-2">
                <span
                  className={`size-1.5 rounded-full ${
                    job.status === "RUNNING" ? "bg-fr-sage" : "bg-fr-amber"
                  }`}
                />
                <Link
                  to="/hub/jobs/$id"
                  params={{ id: job.id }}
                  className="text-fg hover:text-fr-coral truncate"
                >
                  {job.name}
                </Link>
                <span className="ml-auto font-mono text-[10px] text-fg-faint shrink-0">
                  {slotCount} slot{slotCount === 1 ? "" : "s"}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

function ActiveAlertCard({ heapPct }: { heapPct: number }) {
  return (
    <div className="glass-card-static p-5">
      <h3 className="section-heading mb-3">Active alert</h3>
      <div
        className={`block rounded-md p-3 ${
          heapPct >= 90
            ? "border border-fr-rose/25 bg-fr-rose/5"
            : "border border-fr-amber/25 bg-fr-amber/5"
        }`}
      >
        <div className="flex items-start gap-2">
          <span className="status-icon in-progress mt-0.5" />
          <div>
            <div className="text-[12.5px] text-fg">
              TM heap utilization &gt; {heapPct}%
            </div>
            <div className="mt-0.5 font-mono text-[10px] text-fg-faint">
              {heapPct >= 90 ? "P1" : "P2"} · scaling recommended
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Lazy-loads a text-tab fetch on first activation. */
function LazyTextTab({
  tabId,
  fetcher,
  renderer,
  empty,
}: {
  tabId: string
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
    // Reload when the active TM changes.
  }, [tabId, load])

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

// LogFileEntry import kept above for forward-looking log-files tab; not used yet.
export type _LogFileMarker = LogFileEntry

export const Route = createFileRoute("/hub/task-managers/$id")({
  component: HubTaskManagerDetail,
})
