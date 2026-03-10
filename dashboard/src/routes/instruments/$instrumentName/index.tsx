import { createFileRoute, Navigate } from "@tanstack/react-router"

export const Route = createFileRoute("/instruments/$instrumentName/")({
  component: () => {
    const { instrumentName } = Route.useParams()
    return <Navigate to="/instruments/$instrumentName/database" params={{ instrumentName }} />
  },
})
