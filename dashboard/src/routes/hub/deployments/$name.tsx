import { createFileRoute, useParams } from "@tanstack/react-router"
import { HubComingSoon } from "@/lib/hub/hub-coming-soon"

function HubDeploymentDetail() {
  const { name } = useParams({ from: "/hub/deployments/$name" })
  return (
    <HubComingSoon
      crumbs={[
        { label: "Deployments", to: "/hub/deployments" },
        { label: name, mono: true },
      ]}
      title={name}
      phase="P3"
      description="Deployment detail — blue/green state, transition timeline, savepoint references, abort controls."
    />
  )
}

export const Route = createFileRoute("/hub/deployments/$name")({
  component: HubDeploymentDetail,
})
