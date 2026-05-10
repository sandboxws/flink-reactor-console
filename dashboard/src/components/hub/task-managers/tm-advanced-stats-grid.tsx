/**
 * Advanced JVM / Netty / GC stats grid for the Hub TM Overview tab — 2×2 grid
 * of glass cards covering JVM Heap/Non-Heap, Outside JVM Direct/Mapped, Netty
 * Shuffle Buffers, and Garbage Collection.
 *
 * Ported from `components/task-managers/tm-overview-tab.tsx` Section 2,
 * restyled with Hub tokens.
 */

import type { TaskManager } from "@flink-reactor/ui"
import { formatBytes } from "@flink-reactor/ui"

interface TmAdvancedStatsGridProps {
  tm: TaskManager
}

export function TmAdvancedStatsGrid({ tm }: TmAdvancedStatsGridProps) {
  const m = tm.metrics

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* JVM (Heap / Non-Heap) Memory */}
      <AdvancedTableCard title="JVM (Heap/Non-Heap) memory">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border bg-dash-surface/50">
              <Th align="left">Type</Th>
              <Th>Committed</Th>
              <Th>Used</Th>
              <Th>Maximum</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td className="font-medium text-fg">Heap</Td>
              <Td mono>{formatBytes(m.heapCommitted)}</Td>
              <Td mono>{formatBytes(m.heapUsed)}</Td>
              <Td mono>{formatBytes(m.heapMax)}</Td>
            </Tr>
            <Tr last>
              <Td className="font-medium text-fg">Non-Heap</Td>
              <Td mono>{formatBytes(m.nonHeapCommitted)}</Td>
              <Td mono>{formatBytes(m.nonHeapUsed)}</Td>
              <Td mono>{formatBytes(m.nonHeapMax)}</Td>
            </Tr>
          </tbody>
        </table>
      </AdvancedTableCard>

      {/* Outside JVM Memory (Direct / Mapped) */}
      <AdvancedTableCard title="Outside JVM memory">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border bg-dash-surface/50">
              <Th align="left">Type</Th>
              <Th>Count</Th>
              <Th>Used</Th>
              <Th>Capacity</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td className="font-medium text-fg">Direct</Td>
              <Td mono>{m.directCount.toLocaleString()}</Td>
              <Td mono>{formatBytes(m.directUsed)}</Td>
              <Td mono>{formatBytes(m.directMax)}</Td>
            </Tr>
            <Tr last>
              <Td className="font-medium text-fg">Mapped</Td>
              <Td mono>{m.mappedCount.toLocaleString()}</Td>
              <Td mono>{formatBytes(m.mappedUsed)}</Td>
              <Td mono>{formatBytes(m.mappedMax)}</Td>
            </Tr>
          </tbody>
        </table>
      </AdvancedTableCard>

      {/* Netty Shuffle Buffers */}
      <AdvancedTableCard title="Netty shuffle buffers">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-dash-border bg-dash-surface/50">
              <Th align="left">Type</Th>
              <Th>Segments</Th>
              <Th>Memory</Th>
            </tr>
          </thead>
          <tbody>
            <Tr>
              <Td className="font-medium text-fg">Available</Td>
              <Td mono>{m.nettyShuffleSegmentsAvailable.toLocaleString()}</Td>
              <Td mono>{formatBytes(m.nettyShuffleMemoryAvailable)}</Td>
            </Tr>
            <Tr>
              <Td className="font-medium text-fg">Used</Td>
              <Td mono>{m.nettyShuffleSegmentsUsed.toLocaleString()}</Td>
              <Td mono>{formatBytes(m.nettyShuffleMemoryUsed)}</Td>
            </Tr>
            <Tr last>
              <Td className="font-medium text-fg">Total</Td>
              <Td mono>{m.nettyShuffleSegmentsTotal.toLocaleString()}</Td>
              <Td mono>{formatBytes(m.nettyShuffleMemoryTotal)}</Td>
            </Tr>
          </tbody>
        </table>
      </AdvancedTableCard>

      {/* Garbage Collection */}
      <AdvancedTableCard title="Garbage collection">
        {m.garbageCollectors.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-fg-faint">
            No GC activity reported.
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border bg-dash-surface/50">
                <Th align="left">Collector</Th>
                <Th>Count</Th>
                <Th>Time (ms)</Th>
              </tr>
            </thead>
            <tbody>
              {m.garbageCollectors.map((gc, i) => (
                <Tr key={gc.name} last={i === m.garbageCollectors.length - 1}>
                  <Td className="font-medium text-fg">{gc.name}</Td>
                  <Td mono>{gc.count.toLocaleString()}</Td>
                  <Td mono>{gc.time.toLocaleString()}</Td>
                </Tr>
              ))}
            </tbody>
          </table>
        )}
      </AdvancedTableCard>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Internal table primitives
// ---------------------------------------------------------------------------

function AdvancedTableCard({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="glass-card-static overflow-hidden">
      <div className="border-b border-dash-border px-4 py-2.5">
        <h4 className="section-heading">{title}</h4>
      </div>
      {children}
    </div>
  )
}

function Th({
  children,
  align = "right",
}: {
  children: React.ReactNode
  align?: "left" | "right"
}) {
  return (
    <th
      className={`px-4 py-1.5 font-medium text-fg-faint ${
        align === "left" ? "text-left" : "text-right"
      }`}
    >
      {children}
    </th>
  )
}

function Tr({
  children,
  last = false,
}: {
  children: React.ReactNode
  last?: boolean
}) {
  return (
    <tr
      className={`transition-colors hover:bg-dash-hover ${
        last ? "" : "border-b border-dash-border/50"
      }`}
    >
      {children}
    </tr>
  )
}

function Td({
  children,
  className = "",
  mono = false,
}: {
  children: React.ReactNode
  className?: string
  mono?: boolean
}) {
  const base = mono
    ? "px-4 py-1.5 text-right font-mono tabular-nums text-fg-muted"
    : "px-4 py-1.5 text-fg-muted"
  return <td className={`${base} ${className}`}>{children}</td>
}
