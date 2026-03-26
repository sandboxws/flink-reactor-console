"use client"

/**
 * JobDetailSection — Tabbed job detail view.
 *
 * Composes JobHeader with a tab bar containing domain tab components:
 * Vertices, Exceptions, Data Skew, Timeline, Checkpoints,
 * Sources & Sinks, and Configuration.
 *
 * The Overview (graph) tab renders a plan-vertices list as a fallback
 * since the full ReactFlow DAG requires lazy loading and @xyflow/react.
 *
 * Accepts pure data props — no stores, no router.
 */

import { useState } from "react"
import type { FlinkFeatureFlags, FlinkJob } from "../../types"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../../components/ui/tabs"
import { JobHeader } from "../../components/jobs/job-header"
import { VerticesTab } from "../../components/jobs/vertices-tab"
import { ExceptionsTab } from "../../components/jobs/exceptions-tab"
import { DataSkewTab } from "../../components/jobs/data-skew-tab"
import { TimelineTab } from "../../components/jobs/timeline-tab"
import { CheckpointsTab } from "../../components/jobs/checkpoints-tab"
import { SourcesSinksTab } from "../../components/jobs/sources-sinks-tab"
import { ConfigurationTab } from "../../components/jobs/configuration-tab"

// ---------------------------------------------------------------------------
// Plan vertices fallback (no ReactFlow dependency)
// ---------------------------------------------------------------------------

function PlanVerticesList({ job }: { job: FlinkJob }) {
  const vertices = job.plan?.vertices ?? []

  if (vertices.length === 0) {
    return (
      <div className="glass-card flex items-center justify-center py-16 text-xs text-zinc-500">
        No execution plan available
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      {vertices.map((v, i) => (
        <div key={v.id} className="glass-card flex items-center gap-3 p-3">
          <span className="flex size-6 items-center justify-center rounded-full bg-fr-purple/15 text-[10px] font-medium text-fr-purple">
            {i + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-zinc-200">
              {v.name}
            </p>
            <p className="text-xs text-zinc-500">
              Parallelism: {v.parallelism} &middot; Status: {v.status}
            </p>
          </div>
          <div className="text-right text-xs text-zinc-500">
            <div>
              {(v.metrics.recordsIn / 1000).toFixed(0)}k in /{" "}
              {(v.metrics.recordsOut / 1000).toFixed(0)}k out
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// JobDetailSection
// ---------------------------------------------------------------------------

/** Renders the job detail section with status header and tabbed views for vertices, exceptions, data skew, timeline, checkpoints, sources/sinks, and configuration. */
export function JobDetailSection({
  job,
  featureFlags,
  tappablePipelines,
  onBack,
  onCancel,
  onSavepoint,
}: {
  job: FlinkJob
  featureFlags?: FlinkFeatureFlags
  tappablePipelines?: Set<string>
  onBack?: () => void
  onCancel?: () => void
  onSavepoint?: () => void
}) {
  const [activeTab, setActiveTab] = useState("overview")
  const [selectedVertexId, setSelectedVertexId] = useState<string | undefined>()

  // Build vertex ID → operator name map for checkpoint detail
  const vertexNames: Record<string, string> = {}
  for (const v of job.plan?.vertices ?? []) {
    vertexNames[v.id] = v.name
  }

  // No-op checkpoint fetchers (templates don't fetch data)
  const noopFetchDetail = async () => null
  const noopFetchSubtaskDetail = async () => [] as never[]

  return (
    <div className="flex flex-col gap-4">
      <JobHeader
        job={job}
        featureFlags={featureFlags}
        tappablePipelines={tappablePipelines}
        onBack={onBack}
        onCancelJob={onCancel}
        onCreateSavepoint={onSavepoint}
      />

      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="flex min-h-0 flex-1 flex-col"
      >
        <TabsList className="detail-tabs-list">
          <TabsTrigger value="overview" className="detail-tab">
            Overview
          </TabsTrigger>
          <TabsTrigger value="vertices" className="detail-tab">
            Vertices
          </TabsTrigger>
          <TabsTrigger value="exceptions" className="detail-tab">
            Exceptions
            {job.exceptions.length > 0 && (
              <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-job-failed/20 text-[10px] text-job-failed">
                {job.exceptions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="data-skew" className="detail-tab">
            Data Skew
          </TabsTrigger>
          <TabsTrigger value="timeline" className="detail-tab">
            Timeline
          </TabsTrigger>
          <TabsTrigger value="checkpoints" className="detail-tab">
            Checkpoints
          </TabsTrigger>
          <TabsTrigger value="sources-sinks" className="detail-tab">
            Sources &amp; Sinks
            {job.sourcesAndSinks.length > 0 && (
              <span className="ml-1.5 inline-flex size-4 items-center justify-center rounded-full bg-blue-500/20 text-[10px] text-blue-400">
                {job.sourcesAndSinks.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="configuration" className="detail-tab">
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 flex-1">
          <PlanVerticesList job={job} />
        </TabsContent>

        <TabsContent value="vertices" className="mt-4 flex-1 overflow-auto">
          <VerticesTab job={job} selectedVertexId={selectedVertexId} />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4 flex-1 overflow-auto">
          <ExceptionsTab exceptions={job.exceptions} />
        </TabsContent>

        <TabsContent value="data-skew" className="mt-4 flex-1 overflow-auto">
          <DataSkewTab
            subtaskMetrics={job.subtaskMetrics}
            vertices={job.plan?.vertices ?? []}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4 flex-1 overflow-auto">
          <TimelineTab
            vertices={job.plan?.vertices ?? []}
            jobStartTime={job.startTime}
          />
        </TabsContent>

        <TabsContent value="checkpoints" className="mt-4 flex-1 overflow-auto">
          <CheckpointsTab
            jobId={job.id}
            checkpoints={job.checkpoints}
            counts={job.checkpointCounts}
            config={job.checkpointConfig}
            checkpointLatest={job.checkpointLatest}
            vertexNames={vertexNames}
            fetchCheckpointDetail={noopFetchDetail}
            fetchCheckpointSubtaskDetail={noopFetchSubtaskDetail}
          />
        </TabsContent>

        <TabsContent
          value="sources-sinks"
          className="mt-4 flex-1 overflow-auto"
        >
          <SourcesSinksTab sourcesAndSinks={job.sourcesAndSinks} />
        </TabsContent>

        <TabsContent
          value="configuration"
          className="mt-4 flex-1 overflow-auto"
        >
          <ConfigurationTab configuration={job.configuration} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
