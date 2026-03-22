import { createFileRoute, Navigate } from "@tanstack/react-router"

function ScenariosIndex() {
  return <Navigate to="/scenarios/healthy" />
}

export const Route = createFileRoute("/scenarios/")({
  component: ScenariosIndex,
})
