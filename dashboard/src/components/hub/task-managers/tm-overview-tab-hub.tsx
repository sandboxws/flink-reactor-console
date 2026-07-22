/**
 * Hub TM Overview tab — composes the four-row layout:
 *
 *   Row 1 — 8/4 grid:  TmMemoryBar  | Properties + Hosted pipelines + Active alert
 *   Row 2 — full:      Memory model card (8 categories + totals)
 *   Row 3 — full:      Advanced 2×2 grid (JVM / Outside JVM / Netty / GC)
 *   Row 4 — full:      Resources (5 bars + Allocated slots)
 *
 * Owns the right-rail cards (`TmPropertiesCard` / `HostedPipelinesCard` /
 * `ActiveAlertCard`) — they were previously inline in the route file and are
 * tightly coupled to this tab.
 */

import type { FlinkJob, TaskManager } from "@flink-reactor/ui"
import { formatBytes } from "@flink-reactor/ui"
import { Link } from "@tanstack/react-router"
import { useMemo } from "react"
import { TmAdvancedStatsGrid } from "./tm-advanced-stats-grid"
import { TmMemoryBar } from "./tm-memory-bar"
import { TmMemoryModelCard } from "./tm-memory-model-card"
import { TmMemoryTrend } from "./tm-memory-trend"
import { TmResourcesSection } from "./tm-resources-section"

interface TmOverviewTabHubProps {
  tm: TaskManager
  runningJobs: FlinkJob[]
  heapPct: number
}

export function TmOverviewTabHub({
  tm,
  runningJobs,
  heapPct,
}: TmOverviewTabHubProps) {
  return (
    <div className="flex flex-col gap-6">
      {/* ── Row 1: Memory bar (left, 8 col) + properties rail (right, 4 col) ── */}
      <section className="grid grid-cols-12 gap-5">
        <div className="col-span-12 lg:col-span-8">
          <TmMemoryBar tm={tm} />
        </div>
        <div className="col-span-12 lg:col-span-4 space-y-4">
          <TmPropertiesCard tm={tm} />
          <HostedPipelinesCard tm={tm} runningJobs={runningJobs} />
          {heapPct >= 75 ? <ActiveAlertCard heapPct={heapPct} /> : null}
        </div>
      </section>

      {/* ── Row 2: Memory model (full width) ─────────────────────────── */}
      <TmMemoryModelCard tm={tm} />

      {/* ── Row 2.5: Memory trend over time (full width) ─────────────── */}
      <TmMemoryTrend tm={tm} />

      {/* ── Row 3: Advanced (full width) ─────────────────────────────── */}
      <section>
        <h2 className="section-heading mb-3">Advanced</h2>
        <TmAdvancedStatsGrid tm={tm} />
      </section>

      {/* ── Row 4: Resources (full width) ────────────────────────────── */}
      <section>
        <h2 className="section-heading mb-3">Resources</h2>
        <TmResourcesSection tm={tm} />
      </section>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Right-rail cards (relocated from routes/hub/task-managers/$id.tsx)
// ---------------------------------------------------------------------------

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
