/**
 * Resources section for the Hub TM Overview tab — five free-resource utilization
 * bars (CPU, Task Heap, Task Off-Heap, Managed, Network) on the left, plus an
 * Allocated Slots table on the right.
 *
 * Uses the `.resource-bar` Hub primitive (single-segment fill) instead of the
 * bespoke `<ResourceBar>` div from `components/task-managers/tm-overview-tab.tsx`.
 * Bar fill color follows Hub utilization tones: sage < 60%, amber 60-85%, rose > 85%.
 */

import type { TaskManager } from "@flink-reactor/ui"

interface TmResourcesSectionProps {
  tm: TaskManager
}

export function TmResourcesSection({ tm }: TmResourcesSectionProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Free resources */}
      <div className="glass-card-static p-5">
        <h3 className="section-heading mb-4">Free resources</h3>
        <div className="flex flex-col gap-3">
          <ResourceBarRow
            label="CPU"
            used={tm.freeResource.cpuCores}
            total={tm.totalResource.cpuCores}
            unit="cores"
          />
          <ResourceBarRow
            label="Task heap memory"
            used={tm.freeResource.taskHeapMemory}
            total={tm.totalResource.taskHeapMemory}
            unit="MB"
          />
          <ResourceBarRow
            label="Task off-heap memory"
            used={tm.freeResource.taskOffHeapMemory}
            total={tm.totalResource.taskOffHeapMemory}
            unit="MB"
          />
          <ResourceBarRow
            label="Managed memory"
            used={tm.freeResource.managedMemory}
            total={tm.totalResource.managedMemory}
            unit="MB"
          />
          <ResourceBarRow
            label="Network memory"
            used={tm.freeResource.networkMemory}
            total={tm.totalResource.networkMemory}
            unit="MB"
          />
        </div>
      </div>

      {/* Allocated slots */}
      <div className="glass-card-static overflow-hidden">
        <div className="border-b border-dash-border px-4 py-2.5">
          <h3 className="section-heading">Allocated slots</h3>
        </div>
        {tm.allocatedSlots.length === 0 ? (
          <p className="px-4 py-10 text-center text-xs text-fg-faint">
            No slots currently allocated
          </p>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-dash-border bg-dash-surface/50">
                <th className="px-3 py-1.5 text-left font-medium text-fg-faint">
                  #
                </th>
                <th className="px-3 py-1.5 text-left font-medium text-fg-faint">
                  Job ID
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-fg-faint">
                  CPU
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-fg-faint">
                  Task heap (MB)
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-fg-faint">
                  Managed (MB)
                </th>
                <th className="px-3 py-1.5 text-right font-medium text-fg-faint">
                  Network (MB)
                </th>
              </tr>
            </thead>
            <tbody>
              {tm.allocatedSlots.map((slot, i) => (
                <tr
                  key={slot.index}
                  className={`transition-colors hover:bg-dash-hover ${
                    i === tm.allocatedSlots.length - 1
                      ? ""
                      : "border-b border-dash-border/50"
                  }`}
                >
                  <td className="px-3 py-1.5 text-fg-muted">{slot.index}</td>
                  <td className="px-3 py-1.5 font-mono text-fg-muted">
                    {slot.jobId.slice(0, 12)}…
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-fg-muted">
                    {slot.resource.cpuCores}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-fg-muted">
                    {slot.resource.taskHeapMemory}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-fg-muted">
                    {slot.resource.managedMemory}
                  </td>
                  <td className="px-3 py-1.5 text-right font-mono tabular-nums text-fg-muted">
                    {slot.resource.networkMemory}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Resource bar row
// ---------------------------------------------------------------------------

/**
 * One free-resource row: label + utilization percent above a single-segment
 * `.resource-bar` primitive, plus a "used / total unit" sub-label.
 *
 * "Free resource" terminology in legacy: `used` here is the unallocated/free
 * portion, `total` is the configured maximum. Utilization shown is the fraction
 * of the resource that is _free_, so high % = lots of headroom (sage), low % =
 * exhausted (rose). This matches legacy ordering (Math.min(100, used/total)).
 */
function ResourceBarRow({
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
  const percent =
    total > 0 ? Math.min(100, Math.round((used / total) * 100)) : 0
  const fill =
    percent > 85
      ? "var(--color-fr-rose)"
      : percent >= 60
        ? "var(--color-fr-amber)"
        : "var(--color-fr-sage)"

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-xs font-medium text-fg">{label}</span>
        <span className="font-mono text-xs tabular-nums text-fg-muted">
          {percent}%
        </span>
      </div>
      <div className="resource-bar" style={{ height: 8 }}>
        <div
          className="seg"
          style={{ width: `${percent}%`, background: fill }}
        />
      </div>
      <span className="font-mono text-[10px] text-fg-faint">
        {used} / {total} {unit}
      </span>
    </div>
  )
}
