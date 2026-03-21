import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flink-reactor/ui"
import { AlertsSectionDemo } from "@flink-reactor/ui/src/templates/monitoring/alerts-section.demo"
import { CheckpointAnalyticsSectionDemo } from "@flink-reactor/ui/src/templates/monitoring/checkpoint-analytics-section.demo"
import { createFileRoute } from "@tanstack/react-router"

function MonitoringTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Monitoring Templates</h1>
        <p className="mt-1 text-fg-muted">
          Active alerts and checkpoint analytics
        </p>
      </div>
      <Tabs defaultValue="alerts">
        <TabsList>
          <TabsTrigger value="alerts">Alerts</TabsTrigger>
          <TabsTrigger value="checkpoint-analytics">
            Checkpoint Analytics
          </TabsTrigger>
        </TabsList>
        <TabsContent value="alerts" className="mt-6">
          <AlertsSectionDemo />
        </TabsContent>
        <TabsContent value="checkpoint-analytics" className="mt-6">
          <CheckpointAnalyticsSectionDemo />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const Route = createFileRoute("/templates/monitoring")({
  component: MonitoringTemplatePage,
})
