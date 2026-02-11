"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import type { FlinkJob } from "@/data/cluster-types";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { JobHeader } from "./detail/job-header";
import { ExceptionsTab } from "./detail/exceptions-tab";
import { DataSkewTab } from "./detail/data-skew-tab";
import { TimelineTab } from "./detail/timeline-tab";
import { CheckpointsTab } from "./detail/checkpoints-tab";
import { ConfigurationTab } from "./detail/configuration-tab";
import { VerticesTab } from "./detail/vertices-tab";

// Dynamic import for ReactFlow component (dagre uses CJS require which breaks SSR)
const JobGraph = dynamic(() => import("./detail/job-graph").then((m) => m.JobGraph), {
  ssr: false,
  loading: () => (
    <div className="glass-card flex items-center justify-center py-16 text-xs text-zinc-500" style={{ height: 500 }}>
      Loading graph...
    </div>
  ),
});

export function JobDetail({
  job,
  onCancelJob,
  onCreateSavepoint,
}: {
  job: FlinkJob;
  onCancelJob?: () => void;
  onCreateSavepoint?: () => void;
}) {
  const [savepointFeedback, setSavepointFeedback] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [selectedVertexId, setSelectedVertexId] = useState<string | undefined>();

  const handleSelectVertex = (vertexId: string) => {
    setSelectedVertexId(vertexId);
    setActiveTab("vertices");
  };

  const handleSavepoint = () => {
    setSavepointFeedback(true);
    setTimeout(() => setSavepointFeedback(false), 2000);
    onCreateSavepoint?.();
  };

  return (
    <div className="flex flex-col gap-4 p-4">
      <JobHeader
        job={job}
        onCancelJob={onCancelJob}
        onCreateSavepoint={handleSavepoint}
      />

      {savepointFeedback && (
        <div className="rounded-md bg-fr-amber/10 px-3 py-2 text-xs text-fr-amber">
          Savepoint trigger sent. Check your savepoint directory for progress.
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
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
          <TabsTrigger value="configuration" className="detail-tab">
            Configuration
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          {job.plan ? (
            <JobGraph plan={job.plan} onSelectVertex={handleSelectVertex} />
          ) : (
            <div className="glass-card flex items-center justify-center py-16 text-xs text-zinc-500">
              No execution plan available
            </div>
          )}
        </TabsContent>

        <TabsContent value="vertices" className="mt-4">
          <VerticesTab job={job} selectedVertexId={selectedVertexId} />
        </TabsContent>

        <TabsContent value="exceptions" className="mt-4">
          <ExceptionsTab exceptions={job.exceptions} />
        </TabsContent>

        <TabsContent value="data-skew" className="mt-4">
          <DataSkewTab
            subtaskMetrics={job.subtaskMetrics}
            vertices={job.plan?.vertices ?? []}
          />
        </TabsContent>

        <TabsContent value="timeline" className="mt-4">
          <TimelineTab
            vertices={job.plan?.vertices ?? []}
            jobStartTime={job.startTime}
          />
        </TabsContent>

        <TabsContent value="checkpoints" className="mt-4">
          <CheckpointsTab
            checkpoints={job.checkpoints}
            config={job.checkpointConfig}
          />
        </TabsContent>

        <TabsContent value="configuration" className="mt-4">
          <ConfigurationTab configuration={job.configuration} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
