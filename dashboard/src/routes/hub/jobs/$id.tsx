/**
 * Hub job detail — /hub/jobs/$id.
 *
 * Mirrors `console-v2/job.html` chrome (breadcrumb, title row, KPI strip,
 * tabs nav) and reuses the existing legacy tab content components for the
 * actual rendering. Re-styling each tab's interior is deferred to a follow-up
 * (specifically called out in the P2 spec as "tab content can keep legacy
 * styling for now; chrome must match the mockup").
 *
 * Layout: HubAppShell with NO right rail — the operator-detail panel lives
 * INSIDE main as a 4/12 column next to the DAG (matches mockup), not in the
 * global page-grid right rail.
 */

import {
  HubBreadcrumb,
  KpiCard,
  LiveDot,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@flink-reactor/ui"
import { createFileRoute, useParams } from "@tanstack/react-router"
import {
  AlertTriangle,
  BarChart3,
  Bookmark,
  Clock,
  Droplets,
  GitBranch,
  Layers,
  ListTree,
  MoreHorizontal,
  RotateCcw,
  SlidersHorizontal,
  Square,
} from "lucide-react"
import { lazy, Suspense, useEffect, useMemo, useState } from "react"
import { CheckpointsTab } from "@/components/jobs/detail/checkpoints-tab"
import { ConfigurationTab } from "@/components/jobs/detail/configuration-tab"
import { ExceptionsTab } from "@/components/jobs/detail/exceptions-tab"
import { TimelineTab } from "@/components/jobs/detail/timeline-tab"
import { VerticesTab } from "@/components/jobs/detail/vertices-tab"
import { HubAppShell } from "@/lib/hub/hub-app-shell"
import { HubLink } from "@/lib/hub/hub-link"
import { useClusterStore } from "@/stores/cluster-store"

/** Lazy-loaded DAG — keeps ReactFlow + xyflow CSS out of the initial chunk. */
const HubJobGraph = lazy(() =>
  import("@/components/hub/jobs/hub-job-graph").then((m) => ({
    default: m.HubJobGraph,
  })),
)

function timeAgo(date: Date | string | null | undefined): string {
  if (!date) return "—"
  const d = typeof date === "string" ? new Date(date) : date
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function HubJobDetail() {
  const { id } = useParams({ from: "/hub/jobs/$id" })
  const fetchJobDetail = useClusterStore((s) => s.fetchJobDetail)
  const clearJobDetail = useClusterStore((s) => s.clearJobDetail)
  const jobDetail = useClusterStore((s) => s.jobDetail)
  const jobDetailLoading = useClusterStore((s) => s.jobDetailLoading)
  const jobDetailError = useClusterStore((s) => s.jobDetailError)
  const cancelJob = useClusterStore((s) => s.cancelJob)
  const triggerSavepoint = useClusterStore((s) => s.triggerSavepoint)
  const stopWithSavepoint = useClusterStore((s) => s.stopWithSavepoint)

  const [activeTab, setActiveTab] = useState("dag")
  const [selectedVertexId, setSelectedVertexId] = useState<string | undefined>()

  useEffect(() => {
    fetchJobDetail(id)
    return () => clearJobDetail()
  }, [id, fetchJobDetail, clearJobDetail])

  const job = jobDetail
  const isRunning = job
    ? ["RUNNING", "CREATED", "RESTARTING", "RECONCILING"].includes(job.status)
    : false
  const totalTasks = job
    ? Object.values(job.tasks).reduce((a, b) => a + b, 0)
    : 0
  const lastCheckpoint = job?.checkpoints[0]
  const vertexNames = useMemo(() => {
    const map: Record<string, string> = {}
    for (const v of job?.plan?.vertices ?? []) map[v.id] = v.name
    return map
  }, [job?.plan])

  const handleSelectVertex = (vertexId: string) => {
    setSelectedVertexId(vertexId)
    setActiveTab("vertices")
  }

  if (jobDetailLoading && !job) {
    return (
      <HubAppShell>
        <div className="flex h-64 items-center justify-center text-[12px] font-mono text-fg-muted">
          Loading job detail…
        </div>
      </HubAppShell>
    )
  }

  if (jobDetailError || !job) {
    return (
      <HubAppShell>
        <HubBreadcrumb
          crumbs={[
            { label: "Pipelines", to: "/hub/jobs/running" },
            { label: id, mono: true },
          ]}
          LinkComponent={HubLink}
        />
        <div className="mt-6 glass-card-static p-6 text-center">
          <AlertTriangle className="mx-auto size-6 text-fr-rose" />
          <h2 className="mt-3 text-[14px] font-medium text-zinc-100">
            {jobDetailError ? "Failed to load job" : "Job not found"}
          </h2>
          <p className="mt-1 text-[12px] text-fg-muted">
            {jobDetailError ?? `No job with ID ${id}.`}
          </p>
        </div>
      </HubAppShell>
    )
  }

  const statusClass =
    job.status === "RUNNING"
      ? "running"
      : job.status === "FINISHED"
        ? "finished"
        : job.status === "FAILED"
          ? "failed"
          : "cancelled"

  return (
    <HubAppShell>
      {/* ── Page header ─────────────────────────────────────────── */}
      <HubBreadcrumb
        crumbs={[
          { label: "Pipelines", to: "/hub/jobs/running" },
          { label: id.slice(0, 8), mono: true },
        ]}
        LinkComponent={HubLink}
      />

      <div className="mt-2 flex items-end justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <Layers className="size-6 text-fr-coral shrink-0" />
            <h1 className="font-sans text-[26px] font-semibold tracking-tight text-zinc-100 truncate">
              {job.name}
            </h1>
            <span className={`status-pill ${statusClass} shrink-0`}>
              {isRunning ? <LiveDot /> : null}
              {job.status.charAt(0) + job.status.slice(1).toLowerCase()}
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-3 text-[12px] text-fg-muted">
            <span className="font-mono">{job.id}</span>
            <span className="text-fg-faint">·</span>
            <span>started {timeAgo(job.startTime)}</span>
            {job.duration > 0 ? (
              <>
                <span className="text-fg-faint">·</span>
                <span>{Math.round(job.duration / 1000 / 60)}m runtime</span>
              </>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isRunning ? (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => triggerSavepoint(job.id)}
              >
                <Bookmark />
                Savepoint
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => stopWithSavepoint(job.id)}
              >
                <RotateCcw />
                Stop with savepoint
              </button>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => cancelJob(job.id)}
                style={{
                  borderColor: "rgba(234,105,98,0.4)",
                  color: "var(--color-fr-rose)",
                }}
              >
                <Square />
                Cancel
              </button>
            </>
          ) : null}
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-icon"
            aria-label="More actions"
          >
            <MoreHorizontal />
          </button>
        </div>
      </div>

      {/* ── KPI strip ───────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-6">
        <KpiCard
          label="Throughput"
          liveDot="sage"
          value={
            <span>
              —<span className="text-[10px] text-fg-muted">M/s</span>
            </span>
          }
        />
        <KpiCard
          label="Watermark"
          value={
            <span>
              —<span className="text-[10px] text-fg-muted">ms</span>
            </span>
          }
        />
        <KpiCard
          label="Tasks"
          value={totalTasks}
          sub={`${job.tasks.running} running`}
        />
        <KpiCard label="Parallelism" value={job.parallelism} />
        <KpiCard
          label="Last ckpt"
          value={
            lastCheckpoint?.duration != null ? (
              <span>
                {lastCheckpoint.duration}
                <span className="text-[10px] text-fg-muted">ms</span>
              </span>
            ) : (
              "—"
            )
          }
          sub={
            lastCheckpoint?.triggerTimestamp
              ? timeAgo(lastCheckpoint.triggerTimestamp)
              : undefined
          }
        />
        <KpiCard
          label="Checkpoints"
          value={job.checkpointCounts?.completed ?? 0}
          sub={
            job.checkpointCounts?.failed
              ? `${job.checkpointCounts.failed} failed`
              : undefined
          }
        />
      </div>

      {/* ── Tabs ────────────────────────────────────────────────── */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="mt-6 flex flex-col"
      >
        <TabsList className="flex w-full items-center gap-1 border-b border-dash-border overflow-x-auto -mb-px bg-transparent p-0">
          <TabsTrigger value="dag" className="tab">
            <GitBranch />
            <span>DAG</span>
          </TabsTrigger>
          <TabsTrigger value="vertices" className="tab">
            <ListTree />
            <span>Vertices</span>
          </TabsTrigger>
          <TabsTrigger value="checkpoints" className="tab">
            <BarChart3 />
            <span>Checkpoints</span>
            {job.checkpointCounts?.completed ? (
              <span className="tab-count">
                {job.checkpointCounts.completed}
              </span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="tab">
            <AlertTriangle />
            <span>Exceptions</span>
            {job.exceptions.length > 0 ? (
              <span className="tab-count">{job.exceptions.length}</span>
            ) : null}
          </TabsTrigger>
          <TabsTrigger value="config" className="tab">
            <SlidersHorizontal />
            <span>Config</span>
          </TabsTrigger>
          <TabsTrigger value="timeline" className="tab">
            <Clock />
            <span>Timeline</span>
          </TabsTrigger>
          <TabsTrigger value="watermarks" className="tab">
            <Droplets />
            <span>Watermarks</span>
          </TabsTrigger>
        </TabsList>

        {/* DAG tab */}
        <TabsContent value="dag" className="mt-6 outline-none">
          <div className="glass-card-static flex flex-col p-5">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="font-sans text-[14px] font-medium text-zinc-100">
                  Operator DAG
                </h3>
                <p className="mt-0.5 text-[11px] text-fg-muted">
                  {job.plan?.vertices.length ?? 0} vertices ·{" "}
                  {job.plan?.edges.length ?? 0} edges · click any operator for
                  detail · ReactFlow rendered
                </p>
              </div>
            </div>
            {job.plan ? (
              <Suspense
                fallback={
                  <div className="fr-dag-mount loading flex items-center justify-center text-[12px] font-mono text-fg-muted">
                    Loading graph…
                  </div>
                }
              >
                <HubJobGraph
                  plan={job.plan}
                  selectedVertexId={selectedVertexId}
                  onSelectVertex={handleSelectVertex}
                />
              </Suspense>
            ) : (
              <div className="py-16 text-center text-[12px] font-mono text-fg-muted">
                No execution plan available
              </div>
            )}
            {/* Legend below the canvas — matches console-v2/job.html */}
            {job.plan ? (
              <div className="mt-3 flex items-center justify-between border-t border-dash-border pt-3 font-mono text-[10px] text-fg-faint">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-coral" />
                    source
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-violet" />
                    operator
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-teal" />
                    shuffle
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="inline-block size-1.5 rounded-full bg-fr-amber" />
                    sink
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span>busy &lt; 300ms/s sage</span>
                  <span>300–600 amber ring</span>
                  <span>≥ 600 rose ring</span>
                  <span className="text-fg-faint">·</span>
                  <span>drag · scroll-zoom · ⇧-select</span>
                </div>
              </div>
            ) : null}
          </div>
        </TabsContent>

        {/* Vertices tab */}
        <TabsContent value="vertices" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <VerticesTab job={job} selectedVertexId={selectedVertexId} />
          </div>
        </TabsContent>

        {/* Checkpoints tab */}
        <TabsContent value="checkpoints" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <CheckpointsTab
              jobId={job.id}
              checkpoints={job.checkpoints}
              counts={job.checkpointCounts}
              config={job.checkpointConfig}
              checkpointLatest={job.checkpointLatest}
              vertexNames={vertexNames}
            />
          </div>
        </TabsContent>

        {/* Exceptions tab */}
        <TabsContent value="exceptions" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <ExceptionsTab exceptions={job.exceptions} />
          </div>
        </TabsContent>

        {/* Config tab */}
        <TabsContent value="config" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <ConfigurationTab configuration={job.configuration} />
          </div>
        </TabsContent>

        {/* Timeline tab */}
        <TabsContent value="timeline" className="mt-6 outline-none">
          <div className="glass-card-static p-5">
            <TimelineTab
              vertices={job.plan?.vertices ?? []}
              jobStartTime={job.startTime}
            />
          </div>
        </TabsContent>

        {/* Watermarks tab */}
        <TabsContent value="watermarks" className="mt-6 outline-none">
          <div className="glass-card-static p-8 text-center">
            <p className="text-[12px] text-fg-muted">
              Per-vertex watermarks live in the Vertices tab for now. A
              dedicated Watermarks chart is on the roadmap.
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </HubAppShell>
  )
}

export const Route = createFileRoute("/hub/jobs/$id")({
  component: HubJobDetail,
})
