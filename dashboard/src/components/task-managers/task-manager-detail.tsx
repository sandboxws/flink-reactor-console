import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { format } from "date-fns"
import { ArrowLeft, Clock, Cpu, HardDrive, Loader2, Server } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import type {
  LogFileEntry,
  TaskManager,
  ThreadDumpInfo,
} from "@flink-reactor/ui"
import {
  fetchTaskManagerLog,
  fetchTaskManagerLogs,
  fetchTaskManagerStdout,
  fetchTaskManagerThreadDump,
} from "@/lib/graphql-api-client"
import { TmLogListTab } from "./tm-log-list-tab"
import { TmLogsTab } from "./tm-logs-tab"
import { TmMetricsTab } from "./tm-metrics-tab"
import { TmOverviewTab } from "./tm-overview-tab"
import { TmProfilerTab } from "./tm-profiler-tab"
import { TmStdoutTab } from "./tm-stdout-tab"
import { TmThreadDumpTab } from "./tm-thread-dump-tab"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GB = 1024 ** 3
const MB = 1024 ** 2

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
  if (bytes >= MB) return `${Math.round(bytes / MB)} MB`
  return `${Math.round(bytes / 1024)} KB`
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
// TaskManagerDetail — tabbed detail view for a single TM
// ---------------------------------------------------------------------------

export function TaskManagerDetail({ tm }: { tm: TaskManager }) {
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedLogFile, setSelectedLogFile] = useState<string | null>(null)

  // Lazy-loaded tab data — fetched on demand when tab is activated
  const [logs, setLogs] = useState<string | null>(null)
  const [stdout, setStdout] = useState<string | null>(null)
  const [logFiles, setLogFiles] = useState<LogFileEntry[] | null>(null)
  const [threadDump, setThreadDump] = useState<ThreadDumpInfo | null>(null)

  const loadLogs = useCallback(async () => {
    if (logs !== null) return
    try {
      setLogs(await fetchTaskManagerLog(tm.id))
    } catch {
      setLogs("")
    }
  }, [tm.id, logs])

  const loadStdout = useCallback(async () => {
    if (stdout !== null) return
    try {
      setStdout(await fetchTaskManagerStdout(tm.id))
    } catch {
      setStdout("")
    }
  }, [tm.id, stdout])

  const loadLogFiles = useCallback(async () => {
    if (logFiles !== null) return
    try {
      setLogFiles(await fetchTaskManagerLogs(tm.id))
    } catch {
      setLogFiles([])
    }
  }, [tm.id, logFiles])

  const loadThreadDump = useCallback(async () => {
    try {
      setThreadDump(await fetchTaskManagerThreadDump(tm.id))
    } catch {
      setThreadDump({ threadInfos: [] })
    }
  }, [tm.id])

  // Fetch tab data when tab activates
  useEffect(() => {
    if (activeTab === "logs") loadLogs()
    else if (activeTab === "stdout") loadStdout()
    else if (activeTab === "log-list") loadLogFiles()
    else if (activeTab === "thread-dump") loadThreadDump()
  }, [activeTab, loadLogs, loadStdout, loadLogFiles, loadThreadDump])

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Back link */}
      <Link
        to="/task-managers"
        className="flex w-fit items-center gap-1 text-xs text-zinc-500 transition-colors hover:text-zinc-300"
      >
        <ArrowLeft className="size-3" />
        Task Managers
      </Link>

      {/* Header */}
      <div className="flex items-center gap-3">
        <Server className="size-5 text-fr-purple" />
        <div className="min-w-0">
          <h1 className="text-lg font-semibold text-zinc-100">Task Manager</h1>
          <p className="mt-0.5 font-mono text-xs text-zinc-600">{tm.id}</p>
        </div>
      </div>

      {/* Info panel */}
      <div className="glass-card grid gap-x-8 gap-y-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoItem
          label="Path"
          value={
            <span className="font-mono text-[11px] text-zinc-400 break-all">
              {tm.path}
            </span>
          }
        />
        <InfoItem
          label="Free / All Slots"
          value={
            <span className="tabular-nums">
              {tm.slotsFree} <span className="text-zinc-600">/</span>{" "}
              {tm.slotsTotal}
            </span>
          }
        />
        <InfoItem
          label="Last Heartbeat"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Clock className="size-3 text-zinc-600" />
              {format(tm.lastHeartbeat, "yyyy-MM-dd HH:mm:ss")}
            </span>
          }
        />
        <InfoItem
          label="Data Port"
          value={<span className="tabular-nums">{tm.dataPort}</span>}
        />
        <InfoItem
          label="CPU Cores"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <Cpu className="size-3 text-zinc-600" />
              {tm.cpuCores}
            </span>
          }
        />
        <InfoItem
          label="Physical Memory"
          value={
            <span className="inline-flex items-center gap-1 tabular-nums">
              <HardDrive className="size-3 text-zinc-600" />
              {formatBytes(tm.physicalMemory)}
            </span>
          }
        />
        <InfoItem
          label="JVM Heap Size"
          value={
            <span className="tabular-nums">
              {formatBytes(tm.metrics.heapMax)}
            </span>
          }
        />
        <InfoItem
          label="Flink Managed Memory"
          value={
            <span className="tabular-nums">
              {formatBytes(tm.memoryConfiguration.managedMemory)}
            </span>
          }
        />
      </div>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => {
          setActiveTab(v)
          // Reset log viewer when switching away
          if (v !== "log-list") setSelectedLogFile(null)
        }}
      >
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="overview" className="detail-tab">
            Overview
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

        <TabsContent value="overview">
          <TmOverviewTab tm={tm} />
        </TabsContent>
        <TabsContent value="metrics">
          <TmMetricsTab tm={tm} />
        </TabsContent>
        <TabsContent value="logs">
          {logs === null ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <TmLogsTab logs={logs} />
          )}
        </TabsContent>
        <TabsContent value="stdout">
          {stdout === null ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <TmStdoutTab stdout={stdout} />
          )}
        </TabsContent>
        <TabsContent value="log-list">
          {logFiles === null ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <TmLogListTab
              logFiles={logFiles}
              selectedLog={selectedLogFile}
              onSelectLog={setSelectedLogFile}
              tmId={tm.id}
            />
          )}
        </TabsContent>
        <TabsContent value="thread-dump">
          {threadDump === null ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <TmThreadDumpTab threadDump={threadDump} />
          )}
        </TabsContent>
        <TabsContent value="profiler">
          <TmProfilerTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
