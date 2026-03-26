import { createFileRoute, Navigate } from "@tanstack/react-router"

/** Route: / — Dashboard index, redirects to the overview page. */
export const Route = createFileRoute("/")({
  component: () => <Navigate to="/overview" />,
})
