/**
 * Hub job-manager detail — /hub/job-manager.
 *
 * 6-tab strip (Configuration / Metrics / Logs / StdOut / Threads / Profiler)
 * using the `.tab` primitive. The Configuration tab stacks config table,
 * JVM details, and classpath table in a single scrollable view.
 * Active tab is encoded in `?tab=...` so the URL is shareable;
 * default tab is Configuration without auto-rewriting the URL.
 */

import {
  formatBytes,
  HubBreadcrumb,
  TextViewer,
  type ThreadDumpInfo,
  ThreadDumpViewer,
} from "@flink-reactor/ui"
import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router"
import { useEffect, useState } from "react"
import { HaStatusCard } from "@/components/hub/job-manager/ha-status-card"
import { JmConfigTabHub } from "@/components/hub/job-manager/jm-config-tab-hub"
import {
  JM_TABS,
  type JmTab,
  JmTabsHub,
} from "@/components/hub/job-manager/jm-tabs-hub"
import { HubProfilerSurface } from "@/components/hub/tools/flamegraph/hub-profiler-surface"
import { parseThreadInfos } from "@/data/thread-dump-parser"
import {
  fetchJobManagerStdout,
  fetchJobManagerThreadDump,
} from "@/lib/graphql-api-client"
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

      {jobManager?.haStatus ? (
        <div className="mb-5">
          <HaStatusCard ha={jobManager.haStatus} />
        </div>
      ) : null}

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
      return (
        <JmConfigTabHub
          config={jobManager.config}
          jvm={jobManager.jvm}
          classpath={jobManager.classpath}
        />
      )
    case "metrics":
      return <MetricsTab jm={jobManager} />
    case "logs":
      return <TextViewer text={jobManager.logs} maxHeight={500} />
    case "stdout":
      return <JmStdoutTab />
    case "threads":
      return <JmThreadsTab />
    case "profiler":
      return <HubProfilerSurface />
  }
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

function JmThreadsTab() {
  const [dump, setDump] = useState<ThreadDumpInfo | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchJobManagerThreadDump()
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
  }, [])

  if (dump === null) {
    return <p className="text-[11px] font-mono text-fg-faint">Loading…</p>
  }
  if (error) {
    return <p className="text-[12px] text-fr-rose">{error}</p>
  }

  const threads = parseThreadInfos(dump.threadInfos)
  if (threads.length === 0) {
    return (
      <p className="text-[12px] text-fg-muted">Thread dump not available.</p>
    )
  }

  const handleCopyAll = () => {
    const raw = dump.threadInfos
      .map((info) => info.stringifiedThreadInfo)
      .join("\n\n")
    navigator.clipboard.writeText(raw)
  }

  return <ThreadDumpViewer threads={threads} onCopyAll={handleCopyAll} />
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
