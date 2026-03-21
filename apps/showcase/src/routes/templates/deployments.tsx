import { DeploymentsSectionDemo } from "@flink-reactor/ui/src/templates/deployments/deployments-section.demo"
import { createFileRoute } from "@tanstack/react-router"

function DeploymentsTemplatePage() {
  return (
    <div className="flex flex-col gap-8 p-6">
      <div>
        <h1 className="text-2xl font-semibold text-fg">Deployments Template</h1>
        <p className="mt-1 text-fg-muted">Blue-green deployment management</p>
      </div>
      <DeploymentsSectionDemo />
    </div>
  )
}

export const Route = createFileRoute("/templates/deployments")({
  component: DeploymentsTemplatePage,
})
