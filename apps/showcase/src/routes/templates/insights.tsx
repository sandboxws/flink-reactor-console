import { Tabs, TabsContent, TabsList, TabsTrigger } from "@flink-reactor/ui"
import { BottleneckSectionDemo } from "@flink-reactor/ui/src/templates/insights/bottleneck-section.demo"
import { HealthDashboardSectionDemo } from "@flink-reactor/ui/src/templates/insights/health-dashboard-section.demo"
import { createFileRoute } from "@tanstack/react-router"

/** Showcase route: /templates/insights -- Demonstrates the insights template sections (health dashboard, bottleneck analysis). */
function InsightsTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Insights Templates</h1>
        <p className="mt-1 text-fg-muted">
          Health dashboard and bottleneck analysis
        </p>
      </div>
      <Tabs defaultValue="health">
        <TabsList>
          <TabsTrigger value="health">Health Dashboard</TabsTrigger>
          <TabsTrigger value="bottleneck">Bottleneck Analysis</TabsTrigger>
        </TabsList>
        <TabsContent value="health" className="mt-6">
          <HealthDashboardSectionDemo />
        </TabsContent>
        <TabsContent value="bottleneck" className="mt-6">
          <BottleneckSectionDemo />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export const Route = createFileRoute("/templates/insights")({
  component: InsightsTemplatePage,
})
