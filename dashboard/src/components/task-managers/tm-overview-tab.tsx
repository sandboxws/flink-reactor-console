"use client"

import type { TaskManager } from "@/data/cluster-types"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GB = 1024 ** 3
const MB = 1024 ** 2

function formatBytes(bytes: number): string {
  if (bytes >= GB) return `${(bytes / GB).toFixed(1)} GB`
  if (bytes >= MB) return `${(bytes / MB).toFixed(1)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${bytes} B`
}

function formatBytesMB(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`
}

function pct(used: number, max: number): number {
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

// ---------------------------------------------------------------------------
// Memory model progress bar row
// ---------------------------------------------------------------------------

function MemoryModelRow({
  label,
  configuredBytes,
  usedBytes,
  maxBytes,
  color,
}: {
  label: string
  configuredBytes: number
  usedBytes?: number
  maxBytes?: number
  color: string
}) {
  const hasMetric = usedBytes != null && maxBytes != null && maxBytes > 0
  const percent = hasMetric ? pct(usedBytes, maxBytes) : null

  return (
    <div className="grid grid-cols-[1fr_100px_1fr_60px] items-center gap-3 py-2">
      <span className="text-xs text-zinc-300">{label}</span>
      <span className="text-right font-mono text-xs tabular-nums text-zinc-400">
        {formatBytesMB(configuredBytes)}
      </span>
      {hasMetric ? (
        <>
          <div className="flex flex-col gap-1">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-dash-surface">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${percent}%`, backgroundColor: color }}
              />
            </div>
            <span className="font-mono text-[10px] text-zinc-500">
              {formatBytes(usedBytes)} / {formatBytes(maxBytes)}
            </span>
          </div>
          <span className="text-right font-mono text-xs tabular-nums text-zinc-400">
            {percent}%
          </span>
        </>
      ) : (
        <>
          <span className="text-center text-[10px] text-zinc-600">—</span>
          <span />
        </>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Section header
// ---------------------------------------------------------------------------

function SectionHeader({ title }: { title: string }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
      {title}
    </h2>
  )
}

// ---------------------------------------------------------------------------
// Resource utilization bar
// ---------------------------------------------------------------------------

function ResourceBar({
  label,
  used,
  total,
  unit,
}: {
  label: string
  used: number
  total: number
  unit: string
}) {
  const percent = total > 0 ? pct(used, total) : 0
  const color =
    percent > 85
      ? "var(--color-job-failed)"
      : percent >= 60
        ? "var(--color-log-warn)"
        : "var(--color-log-debug)"

  return (
    <div className="flex flex-col gap-1.5 py-2">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-zinc-300">{label}</span>
        <span className="font-mono text-xs tabular-nums text-zinc-400">
          {percent}%
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-dash-surface">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${percent}%`, backgroundColor: color }}
        />
      </div>
      <span className="font-mono text-[10px] text-zinc-500">
        {used} / {total} {unit}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TmOverviewTab — Memory model, Advanced JVM, Resources
// ---------------------------------------------------------------------------

export function TmOverviewTab({ tm }: { tm: TaskManager }) {
  const m = tm.metrics
  const mc = tm.memoryConfiguration

  return (
    <div className="flex flex-col gap-6 pt-4">
      {/* ================================================================= */}
      {/* Section 1: Memory Model                                           */}
      {/* ================================================================= */}
      <div>
        <SectionHeader title="Memory" />
        <div className="mt-3 glass-card overflow-hidden">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_100px_1fr_60px] gap-3 border-b border-dash-border px-4 py-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Flink Memory Model
            </span>
            <span className="text-right text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Configured
            </span>
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">
              Metric
            </span>
            <span />
          </div>
          <div className="flex flex-col divide-y divide-dash-border/50 px-4">
            <MemoryModelRow
              label="Framework Heap"
              configuredBytes={mc.frameworkHeap}
              color="var(--color-fr-coral)"
            />
            <MemoryModelRow
              label="Task Heap"
              configuredBytes={mc.taskHeap}
              usedBytes={m.heapUsed}
              maxBytes={m.heapMax}
              color="var(--color-fr-coral)"
            />
            <MemoryModelRow
              label="Managed Memory"
              configuredBytes={mc.managedMemory}
              usedBytes={m.managedMemoryUsed}
              maxBytes={m.managedMemoryTotal}
              color="var(--color-fr-purple)"
            />
            <MemoryModelRow
              label="Framework Off-Heap"
              configuredBytes={mc.frameworkOffHeap}
              color="var(--color-log-debug)"
            />
            <MemoryModelRow
              label="Task Off-Heap"
              configuredBytes={mc.taskOffHeap}
              color="var(--color-log-debug)"
            />
            <MemoryModelRow
              label="Network"
              configuredBytes={mc.networkMemory}
              usedBytes={m.nettyShuffleMemoryUsed}
              maxBytes={m.nettyShuffleMemoryTotal}
              color="var(--color-job-running)"
            />
            <MemoryModelRow
              label="JVM Metaspace"
              configuredBytes={mc.jvmMetaspace}
              usedBytes={m.metaspaceUsed}
              maxBytes={m.metaspaceMax}
              color="var(--color-log-debug)"
            />
            <MemoryModelRow
              label="JVM Overhead"
              configuredBytes={mc.jvmOverhead}
              color="var(--color-fr-amber)"
            />
          </div>
          {/* Totals */}
          <div className="border-t border-dash-border px-4 py-2">
            <div className="grid grid-cols-[1fr_100px_1fr_60px] gap-3">
              <span className="text-xs font-medium text-zinc-400">
                Total Flink Memory
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-zinc-300">
                {formatBytesMB(mc.totalFlinkMemory)}
              </span>
              <span />
              <span />
            </div>
            <div className="grid grid-cols-[1fr_100px_1fr_60px] gap-3 mt-1">
              <span className="text-xs font-medium text-zinc-400">
                Total Process Memory
              </span>
              <span className="text-right font-mono text-xs tabular-nums text-zinc-300">
                {formatBytesMB(mc.totalProcessMemory)}
              </span>
              <span />
              <span />
            </div>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Section 2: Advanced JVM Metrics                                    */}
      {/* ================================================================= */}
      <div>
        <SectionHeader title="Advanced" />
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {/* JVM Heap / Non-Heap Memory */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                JVM (Heap/Non-Heap) Memory
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface/50">
                  <th className="px-4 py-1.5 text-left font-medium text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Committed
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Used
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Maximum
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-dash-border/50 transition-colors hover:bg-dash-hover">
                  <td className="px-4 py-1.5 font-medium text-zinc-300">
                    Heap
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.heapCommitted)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.heapUsed)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.heapMax)}
                  </td>
                </tr>
                <tr className="transition-colors hover:bg-dash-hover">
                  <td className="px-4 py-1.5 font-medium text-zinc-300">
                    Non-Heap
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.nonHeapCommitted)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.nonHeapUsed)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.nonHeapMax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Outside JVM Memory */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Outside JVM Memory
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface/50">
                  <th className="px-4 py-1.5 text-left font-medium text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Count
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Used
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Capacity
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-dash-border/50 transition-colors hover:bg-dash-hover">
                  <td className="px-4 py-1.5 font-medium text-zinc-300">
                    Direct
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {m.directCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.directUsed)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.directMax)}
                  </td>
                </tr>
                <tr className="transition-colors hover:bg-dash-hover">
                  <td className="px-4 py-1.5 font-medium text-zinc-300">
                    Mapped
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {m.mappedCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.mappedUsed)}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.mappedMax)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Netty Shuffle Buffers */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Netty Shuffle Buffers
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface/50">
                  <th className="px-4 py-1.5 text-left font-medium text-zinc-500">
                    Type
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Segments
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Memory
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-dash-border/50 transition-colors hover:bg-dash-hover">
                  <td className="px-4 py-1.5 font-medium text-zinc-300">
                    Available
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {m.nettyShuffleSegmentsAvailable.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.nettyShuffleMemoryAvailable)}
                  </td>
                </tr>
                <tr className="border-b border-dash-border/50 transition-colors hover:bg-dash-hover">
                  <td className="px-4 py-1.5 font-medium text-zinc-300">
                    Used
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {m.nettyShuffleSegmentsUsed.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.nettyShuffleMemoryUsed)}
                  </td>
                </tr>
                <tr className="transition-colors hover:bg-dash-hover">
                  <td className="px-4 py-1.5 font-medium text-zinc-300">
                    Total
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {m.nettyShuffleSegmentsTotal.toLocaleString()}
                  </td>
                  <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                    {formatBytes(m.nettyShuffleMemoryTotal)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Garbage Collection */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Garbage Collection
              </span>
            </div>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-dash-border bg-dash-surface/50">
                  <th className="px-4 py-1.5 text-left font-medium text-zinc-500">
                    Collector
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Count
                  </th>
                  <th className="px-4 py-1.5 text-right font-medium text-zinc-500">
                    Time (ms)
                  </th>
                </tr>
              </thead>
              <tbody>
                {m.garbageCollectors.map((gc) => (
                  <tr
                    key={gc.name}
                    className="border-b border-dash-border/50 last:border-0 transition-colors hover:bg-dash-hover"
                  >
                    <td className="px-4 py-1.5 font-medium text-zinc-300">
                      {gc.name}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                      {gc.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                      {gc.time.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ================================================================= */}
      {/* Section 3: Resources                                               */}
      {/* ================================================================= */}
      <div>
        <SectionHeader title="Resources" />
        <div className="mt-3 grid gap-4 lg:grid-cols-2">
          {/* Free resources */}
          <div className="glass-card p-4">
            <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
              Free Resources
            </span>
            <div className="mt-3 flex flex-col gap-2">
              <ResourceBar
                label="CPU"
                used={tm.freeResource.cpuCores}
                total={tm.totalResource.cpuCores}
                unit="cores"
              />
              <ResourceBar
                label="Task Heap Memory"
                used={tm.freeResource.taskHeapMemory}
                total={tm.totalResource.taskHeapMemory}
                unit="MB"
              />
              <ResourceBar
                label="Task Off-Heap Memory"
                used={tm.freeResource.taskOffHeapMemory}
                total={tm.totalResource.taskOffHeapMemory}
                unit="MB"
              />
              <ResourceBar
                label="Managed Memory"
                used={tm.freeResource.managedMemory}
                total={tm.totalResource.managedMemory}
                unit="MB"
              />
              <ResourceBar
                label="Network Memory"
                used={tm.freeResource.networkMemory}
                total={tm.totalResource.networkMemory}
                unit="MB"
              />
            </div>
          </div>

          {/* Allocated slots */}
          <div className="glass-card overflow-hidden">
            <div className="border-b border-dash-border px-4 py-2">
              <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                Allocated Slots
              </span>
            </div>
            {tm.allocatedSlots.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-zinc-600">
                No slots currently allocated
              </p>
            ) : (
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-dash-border bg-dash-surface/50">
                    <th className="px-3 py-1.5 text-left font-medium text-zinc-500">
                      #
                    </th>
                    <th className="px-3 py-1.5 text-left font-medium text-zinc-500">
                      Job ID
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium text-zinc-500">
                      CPU
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium text-zinc-500">
                      Task Heap (MB)
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium text-zinc-500">
                      Managed (MB)
                    </th>
                    <th className="px-3 py-1.5 text-right font-medium text-zinc-500">
                      Network (MB)
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tm.allocatedSlots.map((slot) => (
                    <tr
                      key={slot.index}
                      className="border-b border-dash-border/50 last:border-0 transition-colors hover:bg-dash-hover"
                    >
                      <td className="px-3 py-1.5 text-zinc-400">
                        {slot.index}
                      </td>
                      <td className="px-3 py-1.5 font-mono text-zinc-400">
                        {slot.jobId.slice(0, 12)}…
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                        {slot.resource.cpuCores}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                        {slot.resource.taskHeapMemory}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                        {slot.resource.managedMemory}
                      </td>
                      <td className="px-3 py-1.5 text-right font-mono tabular-nums text-zinc-400">
                        {slot.resource.networkMemory}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
