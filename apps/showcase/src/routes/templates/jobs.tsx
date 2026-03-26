import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flink-reactor/ui"
import { CheckpointsSectionDemo } from "@flink-reactor/ui/src/templates/jobs/checkpoints-section.demo"
import { ExceptionsSectionDemo } from "@flink-reactor/ui/src/templates/jobs/exceptions-section.demo"
import { JobDetailSectionDemo } from "@flink-reactor/ui/src/templates/jobs/job-detail-section.demo"
import { JobGraphSectionDemo } from "@flink-reactor/ui/src/templates/jobs/job-graph-section.demo"
import { JobsTableSectionDemo } from "@flink-reactor/ui/src/templates/jobs/jobs-table-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/jobs -- Demonstrates job template sections (table, detail, graph, checkpoints, exceptions). */
function JobsTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Jobs Templates</h1>
        <p className="mt-1 text-fg-muted">
          Job table, detail view, graph, checkpoints, and exceptions
        </p>
      </div>
      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table">Jobs Table</TabsTrigger>
          <TabsTrigger value="detail">Job Detail</TabsTrigger>
          <TabsTrigger value="graph">Job Graph</TabsTrigger>
          <TabsTrigger value="checkpoints">Checkpoints</TabsTrigger>
          <TabsTrigger value="exceptions">Exceptions</TabsTrigger>
        </TabsList>
        <TabsContent value="table" className="mt-6">
          <JobsTableSectionDemo />
        </TabsContent>
        <TabsContent value="detail" className="mt-6">
          <JobDetailSectionDemo />
        </TabsContent>
        <TabsContent value="graph" className="mt-6">
          <JobGraphSectionDemo />
        </TabsContent>
        <TabsContent value="checkpoints" className="mt-6">
          <CheckpointsSectionDemo />
        </TabsContent>
        <TabsContent value="exceptions" className="mt-6">
          <ExceptionsSectionDemo />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const Route = createFileRoute("/templates/jobs")({
  component: JobsTemplatePage,
})
