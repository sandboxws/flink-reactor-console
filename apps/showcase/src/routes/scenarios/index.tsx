import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Showcase route: /scenarios -- Redirects to /scenarios/healthy as the default scenario page. */
function ScenariosIndex() {
  return <Navigate to="/scenarios/healthy" />
}

export const Route = createFileRoute("/scenarios/")({
  component: ScenariosIndex,
})
