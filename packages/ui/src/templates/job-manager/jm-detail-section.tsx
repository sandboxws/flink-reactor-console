"use client"

import { useState } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { TextViewer } from "../../shared/text-viewer"
import { MetricCard } from "../../shared/metric-card"
import { Cpu, HardDrive, MemoryStick, Settings } from "lucide-react"
import type { JobManagerInfo } from "../../types"

export interface JmDetailSectionProps {
  info: JobManagerInfo
}

function fmtBytes(bytes: number): string {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`
  if (bytes >= 1024 ** 2) return `${(bytes / 1024 ** 2).toFixed(0)} MB`
  return `${(bytes / 1024).toFixed(0)} KB`
}

function MemRow({ label, used, max }: { label: string; used: number; max: number }) {
  return (
    <div className="flex justify-between rounded bg-white/[0.02] px-3 py-2">
      <span className="text-zinc-500">{label}</span>
      <span className="font-mono text-zinc-300">{fmtBytes(used)} / {fmtBytes(max)}</span>
    </div>
  )
}

export function JmDetailSection({ info }: JmDetailSectionProps) {
  const [tab, setTab] = useState("config")
  const mem = info.jvm.memoryConfig
  const heapPct = mem.heapMax > 0 ? Math.round((mem.heapUsed / mem.heapMax) * 100) : 0
  const latestHeap = info.metrics.jvmHeapUsed.length > 0
    ? info.metrics.jvmHeapUsed[info.metrics.jvmHeapUsed.length - 1].value
    : mem.heapUsed
  const latestThreads = info.metrics.threadCount.length > 0
    ? Math.round(info.metrics.threadCount[info.metrics.threadCount.length - 1].value)
    : 0

  return (
    <section className="space-y-6 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={MemoryStick} label="Heap Used" value={fmtBytes(latestHeap)}
          accent={heapPct > 85 ? "text-job-failed" : "text-zinc-200"} />
        <MetricCard icon={HardDrive} label="Heap Max" value={fmtBytes(mem.heapMax)} />
        <MetricCard icon={Cpu} label="Threads" value={latestThreads} />
        <MetricCard icon={Settings} label="Config Entries" value={info.config.length} />
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="config" className="detail-tab">Configuration</TabsTrigger>
          <TabsTrigger value="metrics" className="detail-tab">Metrics</TabsTrigger>
          <TabsTrigger value="logs" className="detail-tab">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="config">
          <div className="glass-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-dash-border hover:bg-transparent">
                  <TableHead className="text-[10px]">Key</TableHead>
                  <TableHead className="text-[10px]">Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {info.config.map((c) => (
                  <TableRow key={c.key} className="border-dash-border">
                    <TableCell className="font-mono text-xs text-zinc-300">{c.key}</TableCell>
                    <TableCell className="font-mono text-xs text-zinc-500">{c.value}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="metrics">
          <div className="glass-card space-y-3 p-4">
            <h3 className="text-xs font-medium uppercase tracking-wider text-zinc-500">
              JVM Memory
            </h3>
            <div className="grid gap-3 text-xs sm:grid-cols-2">
              <MemRow label="Heap" used={mem.heapUsed} max={mem.heapMax} />
              <MemRow label="Non-Heap" used={mem.nonHeapUsed} max={mem.nonHeapMax} />
              <MemRow label="Metaspace" used={mem.metaspaceUsed} max={mem.metaspaceMax} />
              <MemRow label="Direct" used={mem.directUsed} max={mem.directMax} />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="logs">
          <div className="glass-card overflow-hidden">
            <TextViewer text={info.logs || "(no log output)"} maxHeight="400px" showLineNumbers showCopyButton />
          </div>
        </TabsContent>
      </Tabs>
    </section>
  )
}
