import { formatBytes, Spinner, Tabs, TabsContent, TabsList, TabsTrigger } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import {
  ArrowLeft,
  Cpu,
  Layers,
  MemoryStick,
  Settings,
  Timer,
} from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import type {
  JobManagerInfo,
  JvmMetricSample,
  LogFileEntry,
  ThreadDumpInfo,
} from "@flink-reactor/ui"
import {
  fetchJobManagerLog,
  fetchJobManagerLogs,
  fetchJobManagerStdout,
  fetchJobManagerThreadDump,
} from "@/lib/graphql-api-client"
import { JmConfigTab } from "./jm-config-tab"
import { JmLogListTab } from "./jm-log-list-tab"
import { JmLogsTab } from "./jm-logs-tab"
import { JmMetricsTab } from "./jm-metrics-tab"
import { JmProfilerTab } from "./jm-profiler-tab"
import { JmStdoutTab } from "./jm-stdout-tab"
import { JmThreadDumpTab } from "./jm-thread-dump-tab"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct(used: number, max: number): number {
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

function latest(samples: JvmMetricSample[]): number {
  if (samples.length === 0) return 0
  return samples[samples.length - 1].value
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
        {label}
      </span>
      <span className="text-xs text-zinc-300">{value}</span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// JobManagerPage — tabbed detail view for the Job Manager
// ---------------------------------------------------------------------------

export function JobManagerPage({ jm }: { jm: JobManagerInfo }) {
  const [activeTab, setActiveTab] = useState("configuration")
  const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null)

  // Lazy-loaded tab data
  const [logs, setLogs] = useState<string | null>(null)
  const [stdout, setStdout] = useState<string | null>(null)
  const [logFiles, setLogFiles] = useState<LogFileEntry[] | null>(null)
  const [threadDump, setThreadDump] = useState<ThreadDumpInfo | null>(null)

  const loadLogs = useCallback(async () => {
    if (logs !== null) return
    try {
      setLogs(await fetchJobManagerLog())
    } catch {
      setLogs("")
    }
  }, [logs])

  const loadStdout = useCallback(async () => {
    if (stdout !== null) return
    try {
      setStdout(await fetchJobManagerStdout())
    } catch {
      setStdout("")
    }
  }, [stdout])

  const loadLogFiles = useCallback(async () => {
    if (logFiles !== null) return
    try {
      setLogFiles(await fetchJobManagerLogs())
    } catch {
      setLogFiles([])
    }
  }, [logFiles])

  const loadThreadDump = useCallback(async () => {
    try {
      setThreadDump(await fetchJobManagerThreadDump())
    } catch {
      setThreadDump({ threadInfos: [] })
    }
  }, [])

  useEffect(() => {
    if (activeTab === "logs") loadLogs()
    else if (activeTab === "stdout") loadStdout()
    else if (activeTab === "log-list") loadLogFiles()
    else if (activeTab === "thread-dump") loadThreadDump()
  }, [activeTab, loadLogs, loadStdout, loadLogFiles, loadThreadDump])

  const mem = jm.jvm.memoryConfig

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back link */}
      <Link
        to="/overview"
        className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" />
        Overview
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Settings className="size-5 text-fr-purple" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-100">Job Manager</h1>
          <p className="mt-0.5 font-mono text-xs text-zinc-600">
            flink-jobmanager:6123
          </p>
        </div>
      </div>

      {/* Summary panel */}
      <div className="glass-card grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem
          label="JVM Heap"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <MemoryStick className="size-3 text-zinc-600" />
              {formatBytes(mem.heapUsed)}{" "}
              <span className="text-zinc-600">/</span>{" "}
              {formatBytes(mem.heapMax)}
              <span className="text-zinc-600">
                ({pct(mem.heapUsed, mem.heapMax)}%)
              </span>
            </span>
          }
        />
        <InfoItem
          label="Non-Heap"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Layers className="size-3 text-zinc-600" />
              {formatBytes(mem.nonHeapUsed)}{" "}
              <span className="text-zinc-600">/</span>{" "}
              {formatBytes(mem.nonHeapMax)}
              <span className="text-zinc-600">
                ({pct(mem.nonHeapUsed, mem.nonHeapMax)}%)
              </span>
            </span>
          }
        />
        <InfoItem
          label="Metaspace"
          value={
            <span className="tabular-nums">
              {formatBytes(mem.metaspaceUsed)}{" "}
              <span className="text-zinc-600">/</span>{" "}
              {formatBytes(mem.metaspaceMax)}
              <span className="text-zinc-600">
                {" "}
                ({pct(mem.metaspaceUsed, mem.metaspaceMax)}%)
              </span>
            </span>
          }
        />
        <InfoItem
          label="Direct Memory"
          value={
            <span className="tabular-nums">
              {formatBytes(mem.directUsed)}{" "}
              <span className="text-zinc-600">/</span>{" "}
              {formatBytes(mem.directMax)}
              <span className="text-zinc-600">
                {" "}
                ({pct(mem.directUsed, mem.directMax)}%)
              </span>
            </span>
          }
        />
        <InfoItem
          label="Threads"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Cpu className="size-3 text-zinc-600" />
              {latest(jm.metrics.threadCount)}
            </span>
          }
        />
        <InfoItem
          label="GC Count"
          value={
            <span className="tabular-nums">{latest(jm.metrics.gcCount)}</span>
          }
        />
        <InfoItem
          label="GC Time"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Timer className="size-3 text-zinc-600" />
              {latest(jm.metrics.gcTime)} ms
            </span>
          }
        />
        <InfoItem
          label="Config Entries"
          value={<span className="tabular-nums">{jm.config.length}</span>}
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v)
          if (v !== "log-list") setSelectedLogFile(null)
        }}
      >
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="configuration" className="detail-tab">
            Configuration
          </TabsTrigger>
          <TabsTrigger value="metrics" className="detail-tab">
            Metrics
          </TabsTrigger>
          <TabsTrigger value="logs" className="detail-tab">
            Logs
          </TabsTrigger>
          <TabsTrigger value="stdout" className="detail-tab">
            Stdout
          </TabsTrigger>
          <TabsTrigger
            value="log-list"
            className="detail-tab"
            onClick={() => setSelectedLogFile(null)}
          >
            Log List
          </TabsTrigger>
          <TabsTrigger value="thread-dump" className="detail-tab">
            Thread Dump
          </TabsTrigger>
          <TabsTrigger value="profiler" className="detail-tab">
            Profiler
          </TabsTrigger>
        </TabsList>

        <TabsContent value="configuration">
          <JmConfigTab
            config={jm.config}
            jvm={jm.jvm}
            classpath={jm.classpath}
          />
        </TabsContent>
        <TabsContent value="metrics">
          <JmMetricsTab metrics={jm.metrics} />
        </TabsContent>
        <TabsContent value="logs">
          {logs === null ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <JmLogsTab logs={logs} />
          )}
        </TabsContent>
        <TabsContent value="stdout">
          {stdout === null ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <JmStdoutTab stdout={stdout} />
          )}
        </TabsContent>
        <TabsContent value="log-list">
          {logFiles === null ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <JmLogListTab
              logFiles={logFiles}
              selectedLog={selectedLogFile}
              onSelectLog={setSelectedLogFile}
            />
          )}
        </TabsContent>
        <TabsContent value="thread-dump">
          {threadDump === null ? (
            <div className="flex items-center justify-center py-20">
              <Spinner size="lg" />
            </div>
          ) : (
            <JmThreadDumpTab threadDump={threadDump} />
          )}
        </TabsContent>
        <TabsContent value="profiler">
          <JmProfilerTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
