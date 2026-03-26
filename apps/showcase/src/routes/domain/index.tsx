import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Showcase route: /domain -- Redirects to /domain/overview as the default domain page. */
function DomainIndex() {
  return <Navigate to="/domain/overview" />
}

export const Route = createFileRoute("/domain/")({ component: DomainIndex })
