import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Showcase route: /templates -- Redirects to /templates/overview as the default template page. */
function TemplatesIndex() {
  return <Navigate to="/templates/overview" />
}

export const Route = createFileRoute("/templates/")({
  component: TemplatesIndex,
})
