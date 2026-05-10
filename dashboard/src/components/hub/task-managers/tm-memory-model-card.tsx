/**
 * Memory model card for the Hub TM Overview tab — full Flink memory breakdown
 * (8 categories with configured size + live-metric progress where available)
 * plus Total Flink / Total Process memory totals.
 *
 * Ported from `components/task-managers/tm-overview-tab.tsx` Section 1, restyled
 * with Hub tokens (`glass-card-static`, `section-heading`, `text-fg/-muted/-faint`).
 */

import type { TaskManager } from "@flink-reactor/ui"
import { formatBytes } from "@flink-reactor/ui"

const MB = 1024 ** 2

function formatBytesMB(bytes: number): string {
  return `${Math.round(bytes / MB)} MB`
}

function pct(used: number, max: number): number {
  if (max === 0) return 0
  return Math.min(100, Math.round((used / max) * 100))
}

interface TmMemoryModelCardProps {
  tm: TaskManager
}

export function TmMemoryModelCard({ tm }: TmMemoryModelCardProps) {
  const m = tm.metrics
  const mc = tm.memoryConfiguration

  return (
    <div className="glass-card-static p-5">
      <h3 className="section-heading mb-4">Memory model</h3>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_100px_1fr_60px] gap-3 border-b border-dash-border pb-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-fg-faint">
          Flink Memory Model
        </span>
        <span className="text-right text-[10px] font-medium uppercase tracking-wide text-fg-faint">
          Configured
        </span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-fg-faint">
          Metric
        </span>
        <span />
      </div>

      <div className="flex flex-col divide-y divide-dash-border/50">
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

      <div className="mt-3 border-t border-dash-border pt-3 space-y-1">
        <div className="grid grid-cols-[1fr_100px_1fr_60px] gap-3">
          <span className="text-xs font-medium text-fg">
            Total Flink Memory
          </span>
          <span className="text-right font-mono text-xs tabular-nums text-fg">
            {formatBytesMB(mc.totalFlinkMemory)}
          </span>
          <span />
          <span />
        </div>
        <div className="grid grid-cols-[1fr_100px_1fr_60px] gap-3">
          <span className="text-xs font-medium text-fg">
            Total Process Memory
          </span>
          <span className="text-right font-mono text-xs tabular-nums text-fg">
            {formatBytesMB(mc.totalProcessMemory)}
          </span>
          <span />
          <span />
        </div>
      </div>
    </div>
  )
}

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
      <span className="text-xs text-fg">{label}</span>
      <span className="text-right font-mono text-xs tabular-nums text-fg-muted">
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
            <span className="font-mono text-[10px] text-fg-faint">
              {formatBytes(usedBytes)} / {formatBytes(maxBytes)}
            </span>
          </div>
          <span className="text-right font-mono text-xs tabular-nums text-fg-muted">
            {percent}%
          </span>
        </>
      ) : (
        <>
          <span className="text-center text-[10px] text-fg-faint">—</span>
          <span />
        </>
      )}
    </div>
  )
}
