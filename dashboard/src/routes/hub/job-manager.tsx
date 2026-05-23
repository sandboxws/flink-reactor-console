/**
 * Hub job-manager detail — /hub/job-manager.
 *
 * Mirrors `console-v2/job-manager.html`: 8-tab strip (Config / Metrics /
 * Logs / StdOut / Classpath / JVM / Threads / Profiler) using the `.tab`
 * primitive. Active tab is encoded in `?tab=...` so the URL is shareable;
 * default tab is Config without auto-rewriting the URL.
 *
 * The Profiler tab renders `<HubFlamegraph>` for any (job, vertex) the
 * user picks — the underlying `flamegraph(jobId, vertexId, type)` query
 * was wired in P4 (`fr-console-hub-tools-instruments`).
 */

import {
  formatBytes,
  HubBreadcrumb,
  TextViewer,
  ThreadDumpViewer,
} from "@flink-reactor/ui"
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { ProfilerPicker } from "@/components/hub/tools/flamegraph/profiler-picker"
import {
  JM_TABS,
  type JmTab,
  JmTabsHub,
} from "@/components/hub/job-manager/jm-tabs-hub"
import { fetchJobManagerStdout } from "@/lib/graphql-api-client"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"

interface JobManagerSearch {
  tab?: JmTab
}

const TABS_SET = new Set(JM_TABS.map((t) => t.id))

function HubJobManager() {
  const navigate = useNavigate()
  const { tab } = useSearch({ from: "/hub/job-manager" })
  const active: JmTab = tab && TABS_SET.has(tab) ? tab : "config"

  const initialize = useClusterStore((s) => s.initialize)
  const startPolling = useClusterStore((s) => s.startPolling)
  const stopPolling = useClusterStore((s) => s.stopPolling)
  const jobManager = useClusterStore((s) => s.jobManager)

  useEffect(() => {
    initialize()
    startPolling()
    return () => stopPolling()
  }, [initialize, startPolling, stopPolling])

  return (
    <HubAppShell>
      <HubBreadcrumb
        crumbs={[{ label: "Cluster" }, { label: "Job manager" }]}
        LinkComponent={HubLink}
      />

      <div className="mt-1 mb-6">
        <h1 className="font-sans text-[24px] font-semibold tracking-tight text-zinc-100">
          Job manager
        </h1>
        <p className="mt-0.5 text-[12px] text-fg-muted">
          {jobManager
            ? `JVM ${formatBytes(jobManager.metrics.jvmHeapMax)} max heap · ${jobManager.classpath.length} classpath entries`
            : "loading…"}
        </p>
      </div>

      <JmTabsHub
        active={active}
        onChange={(t) =>
          navigate({
            to: "/hub/job-manager",
            search: { tab: t === "config" ? undefined : t },
          })
        }
      />

      <div className="mt-5">
        {jobManager ? (
          <Tab tab={active} jobManager={jobManager} />
        ) : (
          <p className="text-[11px] font-mono text-fg-faint">
            Waiting for first poll…
          </p>
        )}
      </div>
    </HubAppShell>
  )
}

interface TabProps {
  tab: JmTab
  jobManager: NonNullable<
    ReturnType<typeof useClusterStore.getState>["jobManager"]
  >
}

function Tab({ tab, jobManager }: TabProps) {
  switch (tab) {
    case "config":
      return <ConfigTab config={jobManager.config} />
    case "metrics":
      return <MetricsTab jm={jobManager} />
    case "logs":
      return <TextViewer text={jobManager.logs} maxHeight={500} />
    case "stdout":
      return <JmStdoutTab />

    case "classpath":
      return <ClasspathTab classpath={jobManager.classpath} />
    case "jvm":
      return <JvmTab jm={jobManager} />
    case "threads":
      return <ThreadDumpViewer dump={jobManager.threadDump} />
    case "profiler":
      return <ProfilerPicker />
  }
}

function ConfigTab({ config }: { config: TabProps["jobManager"]["config"] }) {
  if (config.length === 0) {
    return (
      <p className="text-[11px] font-mono text-fg-faint">No config entries.</p>
    )
  }
  return (
    <div className="glass-card-static overflow-hidden">
      <table className="w-full text-[12px]">
        <thead>
          <tr className="text-[10px] font-mono uppercase tracking-wider text-fg-faint border-b border-dash-border">
            <th className="px-3 py-2 text-left">Key</th>
            <th className="px-3 py-2 text-left">Value</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-dash-border/40">
          {config.map((row) => (
            <tr key={row.key} className="hover:bg-dash-elevated/30">
              <td className="px-3 py-2 font-mono text-fg-muted">{row.key}</td>
              <td className="px-3 py-2 font-mono text-fg break-all">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function MetricsTab({ jm }: { jm: TabProps["jobManager"] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      <KvCard label="Heap max" value={formatBytes(jm.metrics.jvmHeapMax)} />
      <KvCard
        label="Heap used (last sample)"
        value={formatBytes(
          jm.metrics.jvmHeapUsed[jm.metrics.jvmHeapUsed.length - 1]?.value ?? 0,
        )}
      />
      <KvCard
        label="Non-heap max"
        value={formatBytes(jm.metrics.jvmNonHeapMax)}
      />
      <KvCard
        label="Threads"
        value={String(
          jm.metrics.threadCount[jm.metrics.threadCount.length - 1]?.value ?? 0,
        )}
      />
      <KvCard
        label="GC count (cumulative)"
        value={String(
          jm.metrics.gcCount[jm.metrics.gcCount.length - 1]?.value ?? 0,
        )}
      />
      <KvCard
        label="GC time (cumulative)"
        value={`${Math.round(jm.metrics.gcTime[jm.metrics.gcTime.length - 1]?.value ?? 0)} ms`}
      />
    </div>
  )
}

function ClasspathTab({
  classpath,
}: {
  classpath: TabProps["jobManager"]["classpath"]
}) {
  if (classpath.length === 0) {
    return (
      <p className="text-[11px] font-mono text-fg-faint">No classpath data.</p>
    )
  }
  return (
    <div className="glass-card-static overflow-hidden">
      <ul className="divide-y divide-dash-border/40 max-h-[500px] overflow-y-auto">
        {classpath.map((c) => (
          <li
            key={c.path}
            className="px-3 py-2 font-mono text-[11px] text-fg break-all"
          >
            {c.path}
          </li>
        ))}
      </ul>
    </div>
  )
}

function JvmTab({ jm }: { jm: TabProps["jobManager"] }) {
  const heapPct = pct(
    jm.metrics.jvmHeapUsed[jm.metrics.jvmHeapUsed.length - 1]?.value ?? 0,
    jm.metrics.jvmHeapMax,
  )
  return (
    <div className="space-y-4">
      <div className="glass-card-static p-5">
        <h3 className="section-heading mb-3">Heap</h3>
        <div className="resource-bar mb-2">
          <div className="seg heap" style={{ width: `${heapPct}%` }} />
          <div className="seg free" style={{ width: `${100 - heapPct}%` }} />
        </div>
        <p className="text-[12px] font-mono text-fg-muted">
          {heapPct}% used of {formatBytes(jm.metrics.jvmHeapMax)}
        </p>
      </div>
      <div className="glass-card-static p-5">
        <h3 className="section-heading mb-3">Garbage collection</h3>
        <p className="text-[12px] font-mono text-fg-muted">
          {jm.metrics.gcCount[jm.metrics.gcCount.length - 1]?.value ?? 0}{" "}
          collections ·{" "}
          {Math.round(
            jm.metrics.gcTime[jm.metrics.gcTime.length - 1]?.value ?? 0,
          )}{" "}
          ms total time
        </p>
      </div>
    </div>
  )
}

function JmStdoutTab() {
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJobManagerStdout()
      .then((t) => {
        if (!cancelled) {
          setText(t)
          setError(null)
        }
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Failed to load")
          setText("")
        }
      })
    return () => {
      cancelled = true
    }
  }, [])

  if (text === null) {
    return <p className="text-[11px] font-mono text-fg-faint">Loading…</p>
  }
  if (error) {
    return <p className="text-[12px] text-fr-rose">{error}</p>
  }
  if (text === "") {
    return <p className="text-[12px] text-fg-muted">No stdout output.</p>
  }
  return <TextViewer text={text} maxHeight={500} />
}

function pct(used: number, max: number): number {
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

function KvCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-label">{label}</div>
      <div className="font-mono text-[14px] text-fg">{value}</div>
    </div>
  )
}

export const Route = createFileRoute("/hub/job-manager")({
  validateSearch: (search: Record<string, unknown>): JobManagerSearch => {
    const tab = typeof search.tab === "string" ? search.tab : undefined
    return tab && TABS_SET.has(tab as JmTab) ? { tab: tab as JmTab } : {}
  },
  component: HubJobManager,
})
